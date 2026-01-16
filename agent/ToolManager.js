class ToolManager {
  constructor(db, agentId) {
    this.db = db;
    this.agentId = agentId;
    this.toolCache = new Map(); // 內存緩存，避免頻繁查詢
  }

  /**
   * 創建新工具
   * @param {Object} toolDefinition - 工具定義對象
   * @returns {number} 工具 ID
   */
  createTool(toolDefinition) {
    // 驗證工具定義
    this.validateToolDefinition(toolDefinition);

    // 保存到數據庫
    const result = this.db.run(`
      INSERT INTO tools (
        agent_id, name, description, category,
        steps, preconditions, expected_outcome,
        success_rate, usage_count, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      this.agentId,
      toolDefinition.name,
      toolDefinition.description,
      toolDefinition.category,
      JSON.stringify(toolDefinition.steps),
      JSON.stringify(toolDefinition.preconditions || []),
      JSON.stringify(toolDefinition.expected_outcome || {}),
      1.0, // 初始成功率
      0,   // 初始使用次數
      toolDefinition.created_by || 'system'
    ]);

    // 更新緩存
    this.toolCache.set(toolDefinition.name, {
      id: result.lastInsertRowid,
      ...toolDefinition
    });

    console.log(`✓ Tool created: ${toolDefinition.name} (ID: ${result.lastInsertRowid})`);
    return result.lastInsertRowid;
  }

  /**
   * 查找適合當前狀態的工具
   * @param {Object} currentState - 當前 Agent 狀態
   * @param {string} intent - 意圖描述（如 "goto_bed", "drink_water"）
   * @returns {Object|null} 匹配的工具
   */
  findMatchingTool(currentState, intent) {
    // 優先從緩存查找
    if (this.toolCache.has(intent)) {
      const tool = this.toolCache.get(intent);
      // 檢查前置條件
      if (this.checkPreconditions(tool, currentState)) {
        return tool;
      }
    }

    // 從數據庫查找
    const tools = this.db.all(`
      SELECT * FROM tools
      WHERE agent_id = ?
        AND status = 'active'
        AND (name = ? OR category LIKE ?)
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT 5
    `, [this.agentId, intent, `%${intent}%`]);

    // 檢查前置條件並返回最佳匹配
    for (const tool of tools) {
      tool.steps = JSON.parse(tool.steps);
      tool.preconditions = JSON.parse(tool.preconditions);
      tool.expected_outcome = JSON.parse(tool.expected_outcome);

      if (this.checkPreconditions(tool, currentState)) {
        this.toolCache.set(tool.name, tool);
        return tool;
      }
    }

    return null;
  }

  /**
   * 智能建議工具（根據當前狀態）
   * @param {Object} currentState - 當前狀態
   * @returns {Object|null} { name, confidence, reason }
   */
  suggestTool(currentState) {
    // 基於狀態自動判斷
    if (currentState.sleepiness > 7) {
      const tool = this.findMatchingTool(currentState, 'goto_bed');
      if (tool) {
        return {
          name: tool.name,
          confidence: 0.95,
          reason: `High sleepiness (${currentState.sleepiness}) matches goto_bed preconditions`
        };
      }
    }

    if (currentState.thirst && currentState.thirst > 7) {
      const tool = this.findMatchingTool(currentState, 'drink_water');
      if (tool) {
        return {
          name: tool.name,
          confidence: 0.92,
          reason: `High thirst (${currentState.thirst}) matches drink_water preconditions`
        };
      }
    }

    // 複合狀態檢查
    if (currentState.sleepiness > 6 && currentState.thirst > 6) {
      const tool = this.findMatchingTool(currentState, 'tired_and_thirsty');
      if (tool) {
        return {
          name: tool.name,
          confidence: 0.90,
          reason: 'Both tired and thirsty, composite tool available'
        };
      }
    }

    return null;
  }

  /**
   * 檢查工具的前置條件是否滿足
   */
  checkPreconditions(tool, currentState) {
    if (!tool.preconditions || tool.preconditions.length === 0) {
      return true;
    }

    for (const condition of tool.preconditions) {
      if (!this.evaluateCondition(condition, currentState)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 評估單個條件
   */
  evaluateCondition(condition, state) {
    const { type, field, operator, value } = condition;

    switch (type) {
      case 'state_check':
        return this.compareValues(state[field], operator, value);

      case 'location_known':
        // 這裡需要檢查記憶系統，暫時返回 true
        // 實際實現需要整合 MemoryManager
        return true;

      case 'custom':
        // 自定義 JavaScript 條件（謹慎使用）
        try {
          return new Function('state', `return ${condition.expression}`)(state);
        } catch (e) {
          console.error('Custom condition evaluation failed:', e);
          return false;
        }

      default:
        return true;
    }
  }

  /**
   * 比較運算符
   */
  compareValues(actual, operator, expected) {
    switch (operator) {
      case '>': return actual > expected;
      case '<': return actual < expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '==': return actual == expected;
      case '!=': return actual != expected;
      default: return false;
    }
  }

  /**
   * 更新工具成功率（基於執行結果）
   */
  updateToolStats(toolId, success) {
    const tool = this.db.get('SELECT success_rate, usage_count FROM tools WHERE id = ?', [toolId]);

    if (!tool) {
      console.error(`Tool ${toolId} not found`);
      return;
    }

    // 使用滑動平均更新成功率
    const newSuccessRate = (tool.success_rate * tool.usage_count + (success ? 1 : 0)) / (tool.usage_count + 1);

    this.db.run(`
      UPDATE tools
      SET success_rate = ?,
          usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newSuccessRate, toolId]);

    console.log(`✓ Tool ${toolId} stats updated: success_rate=${newSuccessRate.toFixed(2)}, usage_count=${tool.usage_count + 1}`);
  }

  /**
   * 獲取所有可用工具（用於注入到 AI Prompt）
   */
  getAvailableToolsForPrompt(currentState) {
    const tools = this.db.all(`
      SELECT name, description, category, success_rate
      FROM tools
      WHERE agent_id = ? AND status = 'active'
      ORDER BY category, success_rate DESC
    `, [this.agentId]);

    // 按類別分組
    const toolsByCategory = {};
    for (const tool of tools) {
      if (!toolsByCategory[tool.category]) {
        toolsByCategory[tool.category] = [];
      }
      toolsByCategory[tool.category].push({
        name: tool.name,
        description: tool.description,
        reliability: `${(tool.success_rate * 100).toFixed(0)}%`
      });
    }

    return toolsByCategory;
  }

  /**
   * 獲取工具詳細信息
   */
  getTool(toolId) {
    const tool = this.db.get('SELECT * FROM tools WHERE id = ? AND agent_id = ?', [toolId, this.agentId]);

    if (tool) {
      tool.steps = JSON.parse(tool.steps);
      tool.preconditions = JSON.parse(tool.preconditions);
      tool.expected_outcome = JSON.parse(tool.expected_outcome);
    }

    return tool;
  }

  /**
   * 根據名稱獲取工具
   */
  getToolByName(name) {
    const tool = this.db.get('SELECT * FROM tools WHERE name = ? AND agent_id = ?', [name, this.agentId]);

    if (tool) {
      tool.steps = JSON.parse(tool.steps);
      tool.preconditions = JSON.parse(tool.preconditions);
      tool.expected_outcome = JSON.parse(tool.expected_outcome);
    }

    return tool;
  }

  /**
   * 驗證工具定義的完整性
   */
  validateToolDefinition(tool) {
    const required = ['name', 'description', 'category', 'steps'];
    for (const field of required) {
      if (!tool[field]) {
        throw new Error(`Tool definition missing required field: ${field}`);
      }
    }

    // 驗證步驟格式
    if (!Array.isArray(tool.steps) || tool.steps.length === 0) {
      throw new Error('Tool steps must be a non-empty array');
    }

    for (const step of tool.steps) {
      if (!step.type || !step.description) {
        throw new Error('Each step must have type and description');
      }
    }
  }

  /**
   * 載入預設工具
   * @param {Array} toolDefinitions - 工具定義數組
   */
  loadPresetTools(toolDefinitions) {
    let loaded = 0;
    let skipped = 0;

    for (const toolDef of toolDefinitions) {
      try {
        // 檢查工具是否已存在
        const existing = this.db.get('SELECT id FROM tools WHERE agent_id = ? AND name = ?', [this.agentId, toolDef.name]);

        if (existing) {
          console.log(`⊙ Tool ${toolDef.name} already exists, skipping`);
          skipped++;
          continue;
        }

        // 創建工具
        this.createTool(toolDef);
        loaded++;
      } catch (error) {
        console.error(`✗ Failed to load tool ${toolDef.name}:`, error.message);
      }
    }

    console.log(`\n✓ Preset tools loaded: ${loaded} new, ${skipped} skipped`);
    return { loaded, skipped };
  }
}

export default ToolManager;
