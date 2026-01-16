class BehaviorExecutor {
  constructor(db, agentId, toolManager, memoryManager) {
    this.db = db;
    this.agentId = agentId;
    this.toolManager = toolManager;
    this.memoryManager = memoryManager;
    this.currentExecution = null;
  }

  /**
   * 執行工具
   * @param {Object} tool - 工具對象
   * @param {Object} context - 執行上下文（當前狀態、WebSocket等）
   * @returns {Object} 執行結果
   */
  async executeTool(tool, context) {
    // 創建執行記錄
    const executionId = this.startExecution(tool.id, context.currentState);

    try {
      console.log(`🔧 Executing tool: ${tool.name}`);

      // 執行每個步驟
      const results = [];
      for (let i = 0; i < tool.steps.length; i++) {
        const step = tool.steps[i];

        console.log(`  Step ${i + 1}/${tool.steps.length}: ${step.description}`);

        const stepResult = await this.executeStep(step, context, results);

        // 檢查步驟是否成功
        if (!stepResult.success) {
          // 記錄失敗
          this.recordStepFailure(executionId, i, step, stepResult.error);

          // 決定是否需要 AI 介入
          if (this.shouldCallAI(step, stepResult)) {
            console.log(`⚠️  Step failed, calling AI for recovery...`);
            return {
              success: false,
              needsAI: true,
              failedAt: i,
              error: stepResult.error,
              context: this.buildRecoveryContext(tool, i, stepResult)
            };
          }

          // 嘗試重試
          if (step.retryable && (step.retries || 0) < 3) {
            console.log(`  Retrying step ${i + 1}...`);
            step.retries = (step.retries || 0) + 1;
            i--; // 重試當前步驟
            continue;
          }

          // 無法恢復，標記為失敗
          this.completeExecution(executionId, false, stepResult.error);
          return {
            success: false,
            error: stepResult.error,
            failedAt: i
          };
        }

        results.push(stepResult);

        // 記錄步驟完成
        this.recordStepCompletion(executionId, i, step, stepResult);
      }

      // 所有步驟完成
      this.completeExecution(executionId, true);

      // 更新工具統計
      this.toolManager.updateToolStats(tool.id, true);

      console.log(`✅ Tool ${tool.name} completed successfully`);

      return {
        success: true,
        results: results,
        finalState: results[results.length - 1].state
      };

    } catch (error) {
      console.error(`❌ Tool execution error:`, error);
      this.completeExecution(executionId, false, error.message);
      this.toolManager.updateToolStats(tool.id, false);

      return {
        success: false,
        error: error.message,
        needsAI: true
      };
    }
  }

  /**
   * 執行單個步驟
   */
  async executeStep(step, context, previousResults) {
    switch (step.type) {
      case 'find_location':
        return await this.executeFind(step, context);

      case 'navigate':
        return await this.executeNavigate(step, context, previousResults);

      case 'action':
        return await this.executeAction(step, context);

      case 'wait':
        return await this.executeWait(step);

      case 'check_state':
        return this.executeCheck(step, context);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * 執行查找位置步驟
   */
  async executeFind(step, context) {
    const resourceType = step.params.resource;

    // 從記憶中查找
    if (this.memoryManager && this.memoryManager.findResourceLocation) {
      const location = await this.memoryManager.findResourceLocation(resourceType);

      if (!location) {
        return {
          success: false,
          error: `Resource "${resourceType}" location unknown`
        };
      }

      return {
        success: true,
        data: { location },
        state: context.currentState
      };
    }

    // 如果沒有記憶管理器，返回模擬數據（測試用）
    console.warn('MemoryManager not available, using mock location');
    return {
      success: true,
      data: { location: { x: 7, y: 6 } }, // 模擬床的位置
      state: context.currentState
    };
  }

  /**
   * 執行導航步驟
   */
  async executeNavigate(step, context, previousResults) {
    let targetX, targetY;

    // 解析目標位置
    if (step.params.useResult !== undefined) {
      // 使用前一個步驟的結果
      const resultIndex = step.params.useResult;
      const location = previousResults[resultIndex]?.data?.location;
      if (!location) {
        return { success: false, error: 'Previous result not found' };
      }
      targetX = location.x;
      targetY = location.y;
    } else {
      targetX = step.params.x;
      targetY = step.params.y;
    }

    // 檢查是否已經在目標位置
    if (context.currentState.position.x === targetX &&
        context.currentState.position.y === targetY) {
      return {
        success: true,
        data: { alreadyAtTarget: true },
        state: context.currentState
      };
    }

    // 發送導航指令給前端
    if (context.sendAction) {
      context.sendAction({
        type: 'navigate',
        x: targetX,
        y: targetY
      }, `Navigating to (${targetX}, ${targetY}) as part of tool execution`);

      // 等待導航完成
      const arrived = await this.waitForNavigation(targetX, targetY, context, step.params.timeout || 30000);

      if (!arrived) {
        return {
          success: false,
          error: 'Navigation timeout or path blocked'
        };
      }

      return {
        success: true,
        data: { arrivedAt: { x: targetX, y: targetY } },
        state: context.currentState
      };
    }

    // 如果沒有 sendAction（測試模式），模擬成功
    console.warn('sendAction not available, simulating navigation success');
    return {
      success: true,
      data: { arrivedAt: { x: targetX, y: targetY } },
      state: context.currentState
    };
  }

  /**
   * 執行動作步驟
   */
  async executeAction(step, context) {
    const actionType = step.params.actionType;

    // 發送動作指令給前端
    if (context.sendAction) {
      context.sendAction({
        type: actionType,
        ...step.params.actionData
      }, step.description);

      // 等待動作完成
      await this.wait(2000); // 簡單等待，實際應監聽完成事件

      return {
        success: true,
        data: { actionCompleted: actionType },
        state: context.currentState
      };
    }

    // 測試模式
    console.warn('sendAction not available, simulating action success');
    return {
      success: true,
      data: { actionCompleted: actionType },
      state: context.currentState
    };
  }

  /**
   * 執行等待步驟
   */
  async executeWait(step) {
    await this.wait(step.params.duration || 2000);
    return { success: true };
  }

  /**
   * 執行狀態檢查
   */
  executeCheck(step, context) {
    const condition = step.params.condition;
    const satisfied = this.toolManager.evaluateCondition(condition, context.currentState);

    return {
      success: satisfied,
      error: satisfied ? null : 'Condition not satisfied'
    };
  }

  /**
   * 等待導航完成
   */
  async waitForNavigation(targetX, targetY, context, timeout) {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // 檢查是否到達
        if (context.currentState.position.x === targetX &&
            context.currentState.position.y === targetY) {
          clearInterval(checkInterval);
          resolve(true);
        }

        // 檢查超時
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);
    });
  }

  /**
   * 決定是否需要調用 AI
   */
  shouldCallAI(step, stepResult) {
    // 導航失敗 - 需要 AI 重新規劃
    if (step.type === 'navigate' && stepResult.error?.includes('blocked')) {
      return true;
    }

    // 資源未找到 - 需要 AI 探索或使用替代方案
    if (step.type === 'find_location' && stepResult.error?.includes('unknown')) {
      return true;
    }

    // 其他情況，嘗試自動恢復
    return false;
  }

  /**
   * 構建恢復上下文（供 AI 決策使用）
   */
  buildRecoveryContext(tool, failedStepIndex, stepResult) {
    return {
      toolName: tool.name,
      failedStep: tool.steps[failedStepIndex],
      failedStepIndex: failedStepIndex,
      error: stepResult.error,
      completedSteps: tool.steps.slice(0, failedStepIndex),
      remainingSteps: tool.steps.slice(failedStepIndex + 1)
    };
  }

  // === 執行記錄管理 ===

  startExecution(toolId, currentState) {
    const result = this.db.run(`
      INSERT INTO tool_executions (
        agent_id, tool_id, start_time, initial_state, status
      ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, 'running')
    `, [this.agentId, toolId, JSON.stringify(currentState)]);

    this.currentExecution = result.lastInsertRowid;
    return this.currentExecution;
  }

  recordStepCompletion(executionId, stepIndex, step, result) {
    this.db.run(`
      INSERT INTO execution_steps (
        execution_id, step_index, step_type, step_description,
        status, result_data
      ) VALUES (?, ?, ?, ?, 'completed', ?)
    `, [executionId, stepIndex, step.type, step.description, JSON.stringify(result)]);
  }

  recordStepFailure(executionId, stepIndex, step, error) {
    this.db.run(`
      INSERT INTO execution_steps (
        execution_id, step_index, step_type, step_description,
        status, error_message
      ) VALUES (?, ?, ?, ?, 'failed', ?)
    `, [executionId, stepIndex, step.type, step.description, error]);
  }

  completeExecution(executionId, success, errorMessage = null) {
    const duration = Date.now() - this.getExecutionStartTime(executionId);

    this.db.run(`
      UPDATE tool_executions
      SET status = ?,
          end_time = CURRENT_TIMESTAMP,
          duration_ms = ?,
          error_message = ?
      WHERE id = ?
    `, [success ? 'completed' : 'failed', duration, errorMessage, executionId]);

    this.currentExecution = null;
  }

  getExecutionStartTime(executionId) {
    const result = this.db.get('SELECT start_time FROM tool_executions WHERE id = ?', [executionId]);
    return result ? new Date(result.start_time).getTime() : Date.now();
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BehaviorExecutor;
