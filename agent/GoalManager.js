class GoalManager {
  constructor(db, agentId) {
    this.db = db;
    this.agentId = agentId;
  }

  /**
   * 創建新目標
   * @param {string} description - 目標描述
   * @param {string} goalType - 目標類型 (survival, exploration, social, achievement, etc.)
   * @param {number} priority - 優先級 (1-10)
   * @param {Object} metadata - 額外的元數據（如目標條件）
   * @returns {number} 目標 ID
   */
  createGoal(description, goalType = 'general', priority = 5, metadata = null) {
    const result = this.db.run(`
      INSERT INTO goals (agent_id, goal_type, description, priority, status, metadata)
      VALUES (?, ?, ?, ?, 'active', ?)
    `, [this.agentId, goalType, description, priority, metadata ? JSON.stringify(metadata) : null]);

    return result.lastInsertRowid;
  }

  /**
   * 獲取當前活躍的目標（最高優先級）
   * @returns {Object|null} 目標對象
   */
  getCurrentGoal() {
    const row = this.db.get(`
      SELECT * FROM goals
      WHERE agent_id = ? AND status = 'active'
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `, [this.agentId]);

    if (row && row.metadata) {
      row.metadata = JSON.parse(row.metadata);
    }

    return row || null;
  }

  /**
   * 獲取所有活躍目標（按優先級排序）
   * @param {number} limit - 返回數量
   * @returns {Array} 目標列表
   */
  getActiveGoals(limit = 10) {
    const rows = this.db.all(`
      SELECT * FROM goals
      WHERE agent_id = ? AND status = 'active'
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `, [this.agentId, limit]);

    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  /**
   * 獲取特定目標
   * @param {number} goalId - 目標 ID
   * @returns {Object|null} 目標對象
   */
  getGoal(goalId) {
    const row = this.db.get(`
      SELECT * FROM goals
      WHERE id = ? AND agent_id = ?
    `, [goalId, this.agentId]);

    if (row && row.metadata) {
      row.metadata = JSON.parse(row.metadata);
    }

    return row || null;
  }

  /**
   * 更新目標狀態
   * @param {number} goalId - 目標 ID
   * @param {string} newStatus - 新狀態 (active, completed, failed, abandoned)
   */
  updateGoalStatus(goalId, newStatus) {
    const completedAt = (newStatus === 'completed' || newStatus === 'failed')
      ? new Date().toISOString()
      : null;

    return this.db.run(`
      UPDATE goals
      SET status = ?, completed_at = ?
      WHERE id = ? AND agent_id = ?
    `, [newStatus, completedAt, goalId, this.agentId]);
  }

  /**
   * 完成目標
   * @param {number} goalId - 目標 ID
   */
  completeGoal(goalId) {
    return this.updateGoalStatus(goalId, 'completed');
  }

  /**
   * 放棄目標
   * @param {number} goalId - 目標 ID
   */
  abandonGoal(goalId) {
    return this.updateGoalStatus(goalId, 'abandoned');
  }

  /**
   * 標記目標為失敗
   * @param {number} goalId - 目標 ID
   */
  failGoal(goalId) {
    return this.updateGoalStatus(goalId, 'failed');
  }

  /**
   * 更新目標優先級
   * @param {number} goalId - 目標 ID
   * @param {number} newPriority - 新優先級 (1-10)
   */
  updateGoalPriority(goalId, newPriority) {
    return this.db.run(`
      UPDATE goals
      SET priority = ?
      WHERE id = ? AND agent_id = ?
    `, [newPriority, goalId, this.agentId]);
  }

  /**
   * 更新目標元數據
   * @param {number} goalId - 目標 ID
   * @param {Object} metadata - 新的元數據
   */
  updateGoalMetadata(goalId, metadata) {
    return this.db.run(`
      UPDATE goals
      SET metadata = ?
      WHERE id = ? AND agent_id = ?
    `, [JSON.stringify(metadata), goalId, this.agentId]);
  }

  /**
   * 檢查目標是否達成（基於當前狀態和目標條件）
   * @param {Object} currentState - 當前代理狀態
   * @returns {Object} { completed: boolean, goal: Object|null, reason: string }
   */
  checkGoalCompletion(currentState) {
    const goal = this.getCurrentGoal();
    if (!goal) {
      return { completed: false, goal: null, reason: 'No active goal' };
    }

    const metadata = goal.metadata || {};

    // 檢查不同類型的目標達成條件
    switch (goal.goal_type) {
      case 'navigation':
        // 目標：到達特定位置
        if (metadata.target_location) {
          const { x, y } = metadata.target_location;
          if (currentState.position.x === x && currentState.position.y === y) {
            this.completeGoal(goal.id);
            return {
              completed: true,
              goal: goal,
              reason: `Reached target location (${x}, ${y})`
            };
          }
        }
        break;

      case 'sleep':
        // 目標：休息直到睡意歸零
        if (currentState.sleepiness === 0) {
          this.completeGoal(goal.id);
          return {
            completed: true,
            goal: goal,
            reason: 'Sleepiness reset to 0'
          };
        }
        break;

      case 'exploration':
        // 目標：探索 N 個新位置
        if (metadata.target_count && metadata.explored_count >= metadata.target_count) {
          this.completeGoal(goal.id);
          return {
            completed: true,
            goal: goal,
            reason: `Explored ${metadata.explored_count} locations`
          };
        }
        break;

      case 'resource':
        // 目標：收集資源
        if (metadata.resource_type && metadata.target_amount) {
          const currentAmount = currentState.inventory?.[metadata.resource_type] || 0;
          if (currentAmount >= metadata.target_amount) {
            this.completeGoal(goal.id);
            return {
              completed: true,
              goal: goal,
              reason: `Collected ${currentAmount} ${metadata.resource_type}`
            };
          }
        }
        break;

      case 'survival':
        // 目標：生存相關（如保持飢餓度低於某個值）
        if (metadata.condition) {
          const { stat, operator, value } = metadata.condition;
          const currentValue = currentState[stat];

          if (this.evaluateCondition(currentValue, operator, value)) {
            this.completeGoal(goal.id);
            return {
              completed: true,
              goal: goal,
              reason: `Survival condition met: ${stat} ${operator} ${value}`
            };
          }
        }
        break;

      default:
        // 自定義條件檢查
        if (metadata.completion_check && typeof metadata.completion_check === 'function') {
          if (metadata.completion_check(currentState)) {
            this.completeGoal(goal.id);
            return {
              completed: true,
              goal: goal,
              reason: 'Custom condition met'
            };
          }
        }
    }

    return { completed: false, goal: goal, reason: 'Goal not yet completed' };
  }

  /**
   * 評估條件（用於生存目標等）
   * @param {*} currentValue - 當前值
   * @param {string} operator - 操作符 (>, <, >=, <=, ==, !=)
   * @param {*} targetValue - 目標值
   * @returns {boolean}
   */
  evaluateCondition(currentValue, operator, targetValue) {
    switch (operator) {
      case '>': return currentValue > targetValue;
      case '<': return currentValue < targetValue;
      case '>=': return currentValue >= targetValue;
      case '<=': return currentValue <= targetValue;
      case '==': return currentValue == targetValue;
      case '!=': return currentValue != targetValue;
      default: return false;
    }
  }

  /**
   * 獲取已完成的目標歷史
   * @param {number} limit - 返回數量
   * @returns {Array} 已完成的目標列表
   */
  getCompletedGoals(limit = 10) {
    const rows = this.db.all(`
      SELECT * FROM goals
      WHERE agent_id = ? AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT ?
    `, [this.agentId, limit]);

    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  /**
   * 獲取目標統計
   * @returns {Object} 統計信息
   */
  getGoalStats() {
    const stats = this.db.all(`
      SELECT status, COUNT(*) as count
      FROM goals
      WHERE agent_id = ?
      GROUP BY status
    `, [this.agentId]);

    const result = {
      active: 0,
      completed: 0,
      failed: 0,
      abandoned: 0,
      total: 0
    };

    stats.forEach(row => {
      result[row.status] = row.count;
      result.total += row.count;
    });

    return result;
  }

  /**
   * 清除所有目標（慎用！）
   */
  clearAllGoals() {
    return this.db.run(`DELETE FROM goals WHERE agent_id = ?`, [this.agentId]);
  }

  /**
   * 清除已完成/失敗/放棄的目標（清理歷史）
   */
  clearInactiveGoals() {
    return this.db.run(`
      DELETE FROM goals
      WHERE agent_id = ? AND status IN ('completed', 'failed', 'abandoned')
    `, [this.agentId]);
  }
}

export default GoalManager;
