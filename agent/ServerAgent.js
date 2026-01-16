import extract from "extract-json-from-string";
import env from "./env.json" assert { type: "json" };

class ServerAgent {
  constructor(id, memoryManager, goalManager, toolManager, behaviorExecutor, llmProvider, agentConfig, logCallback = null) {
    this.id = id;
    this.memoryManager = memoryManager;
    this.goalManager = goalManager;
    this.toolManager = toolManager;
    this.behaviorExecutor = behaviorExecutor;
    this.llmProvider = llmProvider;      // NEW: LLM Provider abstraction
    this.agentConfig = agentConfig;      // NEW: Agent configuration
    this.logCallback = logCallback; // Callback for sending logs to client
  }

  /**
   * Send log message to client if callback is set
   * @param {string} type - Log type (e.g., 'prompt', 'response', 'error')
   * @param {Object} data - Log data
   */
  sendLog(type, data) {
    if (this.logCallback) {
      this.logCallback({
        type,
        timestamp: new Date().toISOString(),
        agentId: this.id,
        ...data
      });
    }
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

      // 3. 檢查是否有推薦的工具（基於當前狀態）
      const suggestedTool = this.toolManager.suggestTool(parsedData);
      let toolSuggestion = null;

      if (suggestedTool && suggestedTool.confidence > 0.8) {
        console.log(`💡 Tool suggested: ${suggestedTool.name} (confidence: ${suggestedTool.confidence})`);

        // 發送任務建議事件
        this.sendLog('task_update', {
          description: `Suggested: ${suggestedTool.name} - ${suggestedTool.reason}`,
          status: 'pending',
          toolName: suggestedTool.name,
          createdAt: new Date().toISOString()
        });

        toolSuggestion = suggestedTool;
      }

      // 4. 收集記憶和目標上下文
      const context = await this.buildContext(parsedData);

      // 添加工具建議到上下文
      if (toolSuggestion) {
        context.suggestedTool = toolSuggestion;
      }

      // 5. 調用 LLM 做決策
      const decision = await this.makeDecision(context);

      // 6. 檢查 AI 是否使用了建議的工具
      if (toolSuggestion && decision.action) {
        const usedTool = this.checkIfToolUsed(decision.action, toolSuggestion);
        if (usedTool) {
          this.sendLog('task_update', {
            description: `AI using tool: ${toolSuggestion.name}`,
            status: 'in_progress',
            toolName: toolSuggestion.name,
            action: decision.action,
            createdAt: new Date().toISOString()
          });
        }
      }

      // 7. 處理新目標（如果 AI 設定了新目標）
      if (decision.new_goal) {
        console.log(`🎯 New goal set: ${decision.new_goal}`);
        await this.goalManager.createGoal(decision.new_goal, 'general', 5);
      }

      // 8. 記錄決策到短期記憶
      await this.memoryManager.addShortTermMemory(
        { type: 'decision', action: decision.action },
        { reasoning: decision.reasoning || 'No reasoning provided' }
      );

      // 9. 清理舊的短期記憶（保持數據庫整潔）
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

    // Log the prompt being sent to AI
    this.sendLog('prompt', {
      prompt: prompt,
      model: this.model,
      context: {
        position: context.currentState?.position,
        sleepiness: context.currentState?.sleepiness,
        currentGoal: context.currentGoal?.description
      }
    });

    try {
      const response = await this.callLLM(prompt, 0);
      return response;
    } catch (error) {
      console.error("❌ Error making decision:", error);
      this.sendLog('error', { error: error.message });
      return {
        action: { type: "wait" },
        reasoning: "Error in decision making"
      };
    }
  }

  /**
   * 建立性格特質描述
   */
  buildTraitsDescription(personality) {
    if (!personality) return '';

    const { behaviorTendencies, traits, description } = personality;
    const descriptions = [];

    // 行為傾向描述
    if (behaviorTendencies) {
      if (behaviorTendencies.exploration > 70) {
        descriptions.push("You have a strong urge to explore unknown areas");
      } else if (behaviorTendencies.exploration < 30) {
        descriptions.push("You prefer staying in familiar territory");
      }

      if (behaviorTendencies.collection > 70) {
        descriptions.push("You love collecting and hoarding resources");
      }

      if (behaviorTendencies.social > 70) {
        descriptions.push("You seek out social interactions and companionship");
      }

      if (behaviorTendencies.defensive > 70) {
        descriptions.push("You prioritize safety and defensive strategies");
      }
    }

    // 性格特質描述
    if (traits) {
      if (traits.cautious > 70) {
        descriptions.push("You are extremely cautious and risk-averse");
      } else if (traits.bold > 70) {
        descriptions.push("You are bold and enjoy taking calculated risks");
      }

      if (traits.curious > 70) {
        descriptions.push("You have an insatiable curiosity about the world");
      }

      if (traits.lazy > 70) {
        descriptions.push("You prefer efficiency and minimal effort solutions");
      }
    }

    // 自定義描述
    if (description) {
      descriptions.push(description);
    }

    return descriptions.join('. ');
  }

  /**
   * 構建增強的 prompt（包含記憶和目標）
   * @param {Object} context - 上下文
   * @returns {string} Prompt 字符串
   */
  buildEnhancedPrompt(context) {
    const { currentState, recentActions, importantMemories, nearbyLocations, recentInteractions, currentGoal, suggestedTool } = context;
    const personality = this.agentConfig?.personality;

    // === 新增：個性化介紹部分 ===
    let personalitySection = '';
    if (personality) {
      const traits = this.buildTraitsDescription(personality);
      if (traits) {
        personalitySection = `
## Your Personality

${traits}

This personality influences how you interpret situations and make decisions.
`;
      }
    }

    // 構建工具建議部分
    let toolSection = '';
    if (suggestedTool) {
      toolSection = `
# 🔧 Tool Recommendation
**Suggested Tool**: ${suggestedTool.name}
**Confidence**: ${(suggestedTool.confidence * 100).toFixed(0)}%
**Reason**: ${suggestedTool.reason}

You have a high-priority tool recommendation! Consider using it:
- For goto_bed: Use "navigate" action to go to bed location, then "sleep" action when you arrive
- The bed location is stored in your memory at the coordinates you've visited before

`;
    }

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

${personalitySection}${toolSection}${goalSection}

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
- If sleepiness is high (>7), you MUST navigate to bed and sleep
- When using goto_bed: first navigate to bed location, then sleep
- Explore new areas to build your location memory
- Your response must be valid JSON

The JSON response indicating your next action is:`;
  }

  /**
   * 調用 LLM API（通過 Provider 抽象層）
   * @param {string} prompt - Prompt 字符串
   * @param {number} attempt - 當前嘗試次數
   * @returns {Object} 解析後的 JSON 對象
   */
  async callLLM(prompt, attempt = 0) {
    const maxRetries = this.agentConfig?.llmProvider?.maxRetries || 3;

    if (attempt >= maxRetries) {
      console.warn("⚠️  Max retry attempts reached");
      return { action: { type: "wait" }, reasoning: "Failed to get valid response" };
    }

    if (attempt > 0) {
      prompt = "YOU MUST ONLY RESPOND WITH VALID JSON OBJECTS\n\n" + prompt;
    }

    try {
      // 使用抽象的 Provider
      const response = await this.llmProvider.generateWithRetry(prompt, {
        jsonMode: true,
        temperature: this.agentConfig?.llmProvider?.temperature
      }, attempt);

      console.log(`🤖 LLM response (${response.provider}/${response.model}):`, response.content.substring(0, 100) + '...');

      // Log
      this.sendLog('response', {
        response: response.content,
        model: response.model,
        provider: response.provider,
        attempt: attempt + 1,
        usage: response.usage
      });

      // 清理和驗證 JSON
      const responseObject = this.cleanAndProcess(response.content);
      if (responseObject && responseObject.action) {
        return responseObject;
      }

      console.warn("⚠️  Invalid response structure, retrying...");
      return await this.callLLM(prompt, attempt + 1);

    } catch (error) {
      console.error(`❌ LLM API error (attempt ${attempt + 1}):`, error.message);
      return await this.callLLM(prompt, attempt + 1);
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

  /**
   * 檢查 AI 是否使用了建議的工具
   * @param {Object} action - AI 決策的動作
   * @param {Object} toolSuggestion - 建議的工具
   * @returns {boolean}
   */
  checkIfToolUsed(action, toolSuggestion) {
    // 如果建議的是 goto_bed 工具
    if (toolSuggestion.name === 'goto_bed') {
      // 檢查是否是 navigate 到床的位置或 sleep 動作
      return action.type === 'navigate' || action.type === 'sleep';
    }
    return false;
  }
}

export default ServerAgent;
