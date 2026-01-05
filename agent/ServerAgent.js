import OpenAI from "openai";
import extract from "extract-json-from-string";
import env from "./env.json" assert { type: "json" };

class ServerAgent {
  constructor(id, memoryManager, goalManager) {
    this.id = id;
    this.memoryManager = memoryManager;
    this.goalManager = goalManager;

    // Initialize OpenAI client with new SDK (v4+)
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    this.model = env.OPENAI_MODEL || "gpt-4o-mini";
  }

  /**
   * 處理來自客戶端的訊息，做出智能決策
   * @param {Object} parsedData - 當前狀態數據
   * @returns {Object} 決策對象
   */
  async processMessage(parsedData) {
    try {
      // 1. 檢查目標達成
      const goalCheck = await this.goalManager.checkGoalCompletion(parsedData);
      if (goalCheck?.completed) {
        console.log(`🎯 Goal completed: ${goalCheck.goal.description}`);

        // 記錄到長期記憶
        await this.memoryManager.addLongTermMemory({
          type: 'goal_completed',
          description: `Completed goal: ${goalCheck.goal.description}`,
          timestamp: new Date().toISOString()
        }, 9);
      }

      // 2. 記錄當前位置
      if (parsedData.position) {
        await this.memoryManager.recordLocation(
          parsedData.position.x,
          parsedData.position.y,
          'explored'
        );
      }

      // 3. 收集記憶和目標上下文
      const context = await this.buildContext(parsedData);

      // 4. 調用 LLM 做決策
      const decision = await this.makeDecision(context);

      // 5. 處理新目標（如果 AI 設定了新目標）
      if (decision.new_goal) {
        console.log(`🎯 New goal set: ${decision.new_goal}`);
        await this.goalManager.createGoal(decision.new_goal, 'general', 5);
      }

      // 6. 記錄決策到短期記憶
      await this.memoryManager.addShortTermMemory(
        { type: 'decision', action: decision.action },
        { reasoning: decision.reasoning || 'No reasoning provided' }
      );

      // 7. 清理舊的短期記憶（保持數據庫整潔）
      await this.memoryManager.cleanOldShortTermMemories(
        env.MEMORY_SHORT_TERM_SIZE || 20
      );

      return decision;

    } catch (error) {
      console.error("❌ Error processing message:", error);
      // 返回默認的等待動作
      return {
        action: { type: "wait" },
        reasoning: "Error occurred, waiting..."
      };
    }
  }

  /**
   * 構建決策上下文（收集記憶、目標等）
   * @param {Object} parsedData - 當前狀態
   * @returns {Object} 上下文對象
   */
  async buildContext(parsedData) {
    const context = {
      currentState: parsedData,
      recentActions: await this.memoryManager.getRecentActions(
        env.MEMORY_SHORT_TERM_SIZE || 10
      ),
      importantMemories: await this.memoryManager.getImportantMemories(
        env.MEMORY_LONG_TERM_THRESHOLD || 7,
        5
      ),
      currentGoal: await this.goalManager.getCurrentGoal()
    };

    // 只在有位置信息時獲取附近位置
    if (parsedData.position) {
      context.nearbyLocations = await this.memoryManager.getNearbyLocations(
        parsedData.position.x,
        parsedData.position.y,
        env.MEMORY_LOCATION_RADIUS || 5
      );
      context.recentInteractions = await this.memoryManager.getRecentInteractions(null, 5);
    }

    return context;
  }

  /**
   * 使用 LLM 做決策
   * @param {Object} context - 決策上下文
   * @returns {Object} 決策結果
   */
  async makeDecision(context) {
    const prompt = this.buildEnhancedPrompt(context);

    try {
      const response = await this.callOpenAI(prompt, 0);
      return response;
    } catch (error) {
      console.error("❌ Error making decision:", error);
      return {
        action: { type: "wait" },
        reasoning: "Error in decision making"
      };
    }
  }

  /**
   * 構建增強的 prompt（包含記憶和目標）
   * @param {Object} context - 上下文
   * @returns {string} Prompt 字符串
   */
  buildEnhancedPrompt(context) {
    const { currentState, recentActions, importantMemories, nearbyLocations, recentInteractions, currentGoal } = context;

    // 構建目標部分
    let goalSection = '';
    if (currentGoal) {
      goalSection = `
# Current Goal
**Goal**: ${currentGoal.description}
**Priority**: ${currentGoal.priority}/10
**Type**: ${currentGoal.goal_type}

Please prioritize achieving this goal in your decision making.
`;
    } else {
      goalSection = `
# Current Goal
You currently have no active goal. Consider setting a reasonable goal based on your current state (e.g., rest, explore, find resources, etc.).
`;
    }

    // 構建短期記憶部分
    let recentActionsSection = '';
    if (recentActions && recentActions.length > 0) {
      recentActionsSection = `
# Recent Actions (Short-term Memory)
${recentActions.map((a, i) => `${i + 1}. Action: ${JSON.stringify(a.action)} → Result: ${JSON.stringify(a.result)}`).join('\n')}
`;
    }

    // 構建長期記憶部分
    let importantMemoriesSection = '';
    if (importantMemories && importantMemories.length > 0) {
      importantMemoriesSection = `
# Important Memories (Long-term Memory)
${importantMemories.map((m, i) => `${i + 1}. [Importance: ${m.importance}] ${m.description || JSON.stringify(m)}`).join('\n')}
`;
    }

    // 構建位置記憶部分
    let locationsSection = '';
    if (nearbyLocations && nearbyLocations.length > 0) {
      locationsSection = `
# Known Nearby Locations (Location Memory)
${nearbyLocations.map(loc => `- (${loc.x}, ${loc.y}): ${loc.tile_type}, visited ${loc.visit_count} times`).join('\n')}
`;
    }

    // 構建互動記憶部分
    let interactionsSection = '';
    if (recentInteractions && recentInteractions.length > 0) {
      interactionsSection = `
# Recent Interactions (Interaction Memory)
${recentInteractions.map(int => `- ${int.type} at (${int.location.x}, ${int.location.y}): ${JSON.stringify(int.result)}`).join('\n')}
`;
    }

    // 組合完整的 prompt
    return `# Introduction

You are an intelligent AI agent living in a simulated 2D universe. You have memory capabilities and can remember past actions and experiences. Your goal is to exist as best as you see fit and meet your needs.

${goalSection}

# Current State

Position: ${JSON.stringify(currentState.position)}
Surroundings: ${JSON.stringify(currentState.surroundings)}
Sleepiness: ${currentState.sleepiness} out of 10
${recentActionsSection}${importantMemoriesSection}${locationsSection}${interactionsSection}

# Capabilities

You have the following capabilities:
* Move (up, down, left, right) - Move one tile in the specified direction
* Wait - Do nothing for this turn
* Navigate (to x,y coordinate) - Move towards a specific coordinate
* Sleep - Sleep to reduce sleepiness (only works at bed location)

# Response Format

You MUST respond with a valid JSON object in the following format:

{
  "action": {
    "type": "move" | "wait" | "navigate" | "sleep",
    "direction": "up" | "down" | "left" | "right",  // for move only
    "x": number,  // for navigate only
    "y": number   // for navigate only
  },
  "reasoning": "Brief explanation of your decision",
  "new_goal": "Optional: Description of a new goal if you want to set one"
}

Important:
- Consider your current goal when making decisions
- Use your memories to make informed choices
- If sleepiness is high (>7), consider finding a bed to sleep
- Explore new areas to build your location memory
- Your response must be valid JSON

The JSON response indicating your next action is:`;
  }

  /**
   * 調用 OpenAI API（使用新版 SDK）
   * @param {string} prompt - Prompt 字符串
   * @param {number} attempt - 當前嘗試次數
   * @returns {Object} 解析後的 JSON 對象
   */
  async callOpenAI(prompt, attempt) {
    if (attempt > 3) {
      console.warn("⚠️  Max retry attempts reached, returning default action");
      return {
        action: { type: "wait" },
        reasoning: "Failed to get valid response from LLM"
      };
    }

    if (attempt > 0) {
      prompt = "YOU MUST ONLY RESPOND WITH VALID JSON OBJECTS\n\n" + prompt;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are an intelligent AI agent. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },  // Force JSON output
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      console.log('🤖 OpenAI response:', content);

      const responseObject = this.cleanAndProcess(content);
      if (responseObject && responseObject.action) {
        return responseObject;
      }

      console.warn("⚠️  Invalid response structure, retrying...");
      return await this.callOpenAI(prompt, attempt + 1);

    } catch (error) {
      console.error(`❌ OpenAI API error (attempt ${attempt + 1}):`, error.message);
      return await this.callOpenAI(prompt, attempt + 1);
    }
  }

  /**
   * 清理和處理 LLM 響應
   * @param {string} text - 原始文本
   * @returns {Object|null} 解析後的 JSON 對象
   */
  cleanAndProcess(text) {
    try {
      // 嘗試直接解析
      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      // 如果直接解析失敗，使用 extract-json-from-string
      const extractedJson = extract(text)[0];
      return extractedJson || null;
    }
  }
}

export default ServerAgent;
