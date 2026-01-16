class MemoryManager {
  constructor(db, agentId) {
    this.db = db;
    this.agentId = agentId;
  }

  // ========== 短期記憶 (Short-term Memory) ==========

  /**
   * 添加短期記憶
   * @param {Object} action - 執行的行動
   * @param {Object} result - 行動結果
   */
  addShortTermMemory(action, result) {
    const memory = {
      action: action,
      result: result,
      timestamp: new Date().toISOString()
    };

    return this.db.run(`
      INSERT INTO memories (agent_id, memory_type, content, importance)
      VALUES (?, 'short_term', ?, 5)
    `, [this.agentId, JSON.stringify(memory)]);
  }

  /**
   * 獲取最近的行動記憶
   * @param {number} limit - 返回的記憶數量
   * @returns {Array} 短期記憶列表
   */
  getRecentActions(limit = 10) {
    const rows = this.db.all(`
      SELECT content FROM memories
      WHERE agent_id = ? AND memory_type = 'short_term'
      ORDER BY timestamp DESC
      LIMIT ?
    `, [this.agentId, limit]);

    return rows.map(row => JSON.parse(row.content)).reverse();
  }

  /**
   * 清理舊的短期記憶（保留最近 N 條）
   * @param {number} keepCount - 保留的記憶數量
   */
  cleanOldShortTermMemories(keepCount = 20) {
    // 獲取第 N 條記憶的 timestamp
    const cutoffRow = this.db.get(`
      SELECT timestamp FROM memories
      WHERE agent_id = ? AND memory_type = 'short_term'
      ORDER BY timestamp DESC
      LIMIT 1 OFFSET ?
    `, [this.agentId, keepCount - 1]);

    if (cutoffRow) {
      return this.db.run(`
        DELETE FROM memories
        WHERE agent_id = ?
          AND memory_type = 'short_term'
          AND timestamp < ?
      `, [this.agentId, cutoffRow.timestamp]);
    }
  }

  // ========== 長期記憶 (Long-term Memory) ==========

  /**
   * 添加長期記憶（重要事件）
   * @param {Object} event - 事件內容
   * @param {number} importance - 重要性 (1-10)
   */
  addLongTermMemory(event, importance = 8) {
    return this.db.run(`
      INSERT INTO memories (agent_id, memory_type, content, importance)
      VALUES (?, 'long_term', ?, ?)
    `, [this.agentId, JSON.stringify(event), importance]);
  }

  /**
   * 獲取重要的長期記憶
   * @param {number} minImportance - 最低重要性閾值
   * @param {number} limit - 返回數量
   * @returns {Array} 長期記憶列表
   */
  getImportantMemories(minImportance = 7, limit = 5) {
    const rows = this.db.all(`
      SELECT content, importance FROM memories
      WHERE agent_id = ?
        AND memory_type = 'long_term'
        AND importance >= ?
      ORDER BY importance DESC, timestamp DESC
      LIMIT ?
    `, [this.agentId, minImportance, limit]);

    return rows.map(row => ({
      ...JSON.parse(row.content),
      importance: row.importance
    }));
  }

  /**
   * 將短期記憶提升為長期記憶
   * @param {number} memoryId - 記憶 ID
   * @param {number} newImportance - 新的重要性
   */
  promoteToLongTerm(memoryId, newImportance = 8) {
    return this.db.run(`
      UPDATE memories
      SET memory_type = 'long_term', importance = ?
      WHERE id = ? AND agent_id = ?
    `, [newImportance, memoryId, this.agentId]);
  }

  // ========== 位置記憶 (Location Memory) ==========

  /**
   * 記錄探索的位置
   * @param {number} x - X 座標
   * @param {number} y - Y 座標
   * @param {string} tileType - 瓦片類型
   * @param {Object} resources - 該位置的資源
   */
  recordLocation(x, y, tileType, resources = null) {
    return this.db.run(`
      INSERT INTO explored_locations (agent_id, x, y, tile_type, resources)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, x, y) DO UPDATE SET
        visit_count = visit_count + 1,
        last_visited = CURRENT_TIMESTAMP,
        tile_type = excluded.tile_type,
        resources = COALESCE(excluded.resources, resources)
    `, [this.agentId, x, y, tileType, resources ? JSON.stringify(resources) : null]);
  }

  /**
   * 獲取附近已探索的位置
   * @param {number} x - 中心 X 座標
   * @param {number} y - 中心 Y 座標
   * @param {number} radius - 搜索半徑
   * @returns {Array} 附近位置列表
   */
  getNearbyLocations(x, y, radius = 5) {
    const rows = this.db.all(`
      SELECT x, y, tile_type, resources, visit_count
      FROM explored_locations
      WHERE agent_id = ?
        AND x BETWEEN ? AND ?
        AND y BETWEEN ? AND ?
      ORDER BY visit_count DESC
    `, [this.agentId, x - radius, x + radius, y - radius, y + radius]);

    return rows.map(row => ({
      ...row,
      resources: row.resources ? JSON.parse(row.resources) : null
    }));
  }

  /**
   * 查找特定資源的位置
   * @param {string} resourceType - 資源類型 (如 'bed', 'water', 'food')
   * @returns {Object|null} 位置信息
   */
  findResourceLocation(resourceType) {
    const rows = this.db.all(`
      SELECT x, y, resources, visit_count
      FROM explored_locations
      WHERE agent_id = ?
        AND resources LIKE ?
      ORDER BY last_visited DESC
      LIMIT 1
    `, [this.agentId, `%"${resourceType}"%`]);

    if (rows.length > 0) {
      return {
        ...rows[0],
        resources: JSON.parse(rows[0].resources)
      };
    }
    return null;
  }

  /**
   * 獲取訪問次數最多的位置
   * @param {number} limit - 返回數量
   * @returns {Array} 熱門位置列表
   */
  getMostVisitedLocations(limit = 5) {
    const rows = this.db.all(`
      SELECT x, y, tile_type, visit_count
      FROM explored_locations
      WHERE agent_id = ?
      ORDER BY visit_count DESC
      LIMIT ?
    `, [this.agentId, limit]);

    return rows;
  }

  // ========== 互動記憶 (Interaction Memory) ==========

  /**
   * 記錄互動行為
   * @param {string} type - 互動類型 (move, plant, harvest, sleep, etc.)
   * @param {number} x - X 座標
   * @param {number} y - Y 座標
   * @param {Object} result - 互動結果
   */
  recordInteraction(type, x, y, result) {
    return this.db.run(`
      INSERT INTO interactions (agent_id, interaction_type, location_x, location_y, result)
      VALUES (?, ?, ?, ?, ?)
    `, [this.agentId, type, x, y, JSON.stringify(result)]);
  }

  /**
   * 獲取最近的互動記錄
   * @param {string|null} type - 互動類型過濾（null 表示所有類型）
   * @param {number} limit - 返回數量
   * @returns {Array} 互動記錄列表
   */
  getRecentInteractions(type = null, limit = 5) {
    let query = `
      SELECT interaction_type, location_x, location_y, result, timestamp
      FROM interactions
      WHERE agent_id = ?
    `;
    const params = [this.agentId];

    if (type) {
      query += ` AND interaction_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.all(query, params);
    return rows.map(row => ({
      type: row.interaction_type,
      location: { x: row.location_x, y: row.location_y },
      result: JSON.parse(row.result),
      timestamp: row.timestamp
    }));
  }

  /**
   * 獲取特定類型互動的統計
   * @param {string} type - 互動類型
   * @returns {Object} 統計信息
   */
  getInteractionStats(type) {
    const stats = this.db.get(`
      SELECT
        COUNT(*) as total_count,
        MIN(timestamp) as first_time,
        MAX(timestamp) as last_time
      FROM interactions
      WHERE agent_id = ? AND interaction_type = ?
    `, [this.agentId, type]);

    return stats;
  }

  // ========== 通用方法 ==========

  /**
   * 獲取所有記憶的總數
   * @returns {Object} 各類型記憶的數量
   */
  getMemoryStats() {
    const stats = this.db.all(`
      SELECT memory_type, COUNT(*) as count
      FROM memories
      WHERE agent_id = ?
      GROUP BY memory_type
    `, [this.agentId]);

    const locationCount = this.db.get(`
      SELECT COUNT(*) as count
      FROM explored_locations
      WHERE agent_id = ?
    `, [this.agentId]);

    const interactionCount = this.db.get(`
      SELECT COUNT(*) as count
      FROM interactions
      WHERE agent_id = ?
    `, [this.agentId]);

    return {
      memories: stats.reduce((acc, row) => {
        acc[row.memory_type] = row.count;
        return acc;
      }, {}),
      locations: locationCount.count,
      interactions: interactionCount.count
    };
  }

  /**
   * 清除代理的所有記憶（慎用！）
   */
  clearAllMemories() {
    this.db.run(`DELETE FROM memories WHERE agent_id = ?`, [this.agentId]);
    this.db.run(`DELETE FROM explored_locations WHERE agent_id = ?`, [this.agentId]);
    this.db.run(`DELETE FROM interactions WHERE agent_id = ?`, [this.agentId]);
  }
}

export default MemoryManager;
