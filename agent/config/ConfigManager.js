import { AgentConfigValidator } from './AgentConfigSchema.js';

/**
 * ConfigManager - Agent 配置管理器
 * 負責配置的存儲、讀取和更新
 */
class ConfigManager {
  constructor(db) {
    this.db = db;
    this.initializeConfigTable();
  }

  /**
   * 初始化配置表
   */
  initializeConfigTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        agent_id TEXT PRIMARY KEY,
        config TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Agent configs table initialized');
  }

  /**
   * 保存配置（UPSERT）
   * @param {string} agentId
   * @param {Object} config
   * @returns {Object} - 完整的配置對象
   */
  saveConfig(agentId, config) {
    // 驗證配置
    const validation = AgentConfigValidator.validate(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    // 應用默認值
    const fullConfig = AgentConfigValidator.applyDefaults(config);

    // 確保 agentId 一致
    fullConfig.agentId = agentId;

    try {
      this.db.run(`
        INSERT INTO agent_configs (agent_id, config, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(agent_id) DO UPDATE SET
          config = excluded.config,
          updated_at = CURRENT_TIMESTAMP
      `, [agentId, JSON.stringify(fullConfig)]);

      console.log(`✓ Config saved for agent: ${agentId}`);
      return fullConfig;
    } catch (error) {
      console.error(`❌ Failed to save config for ${agentId}:`, error.message);
      throw error;
    }
  }

  /**
   * 獲取配置
   * @param {string} agentId
   * @returns {Object|null}
   */
  getConfig(agentId) {
    try {
      const row = this.db.get(
        'SELECT config FROM agent_configs WHERE agent_id = ?',
        [agentId]
      );

      if (!row) {
        return null;
      }

      return JSON.parse(row.config);
    } catch (error) {
      console.error(`❌ Failed to get config for ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * 更新配置（部分更新）
   * @param {string} agentId
   * @param {Object} partialConfig - 要更新的部分配置
   * @returns {Object} - 更新後的完整配置
   */
  updateConfig(agentId, partialConfig) {
    const existingConfig = this.getConfig(agentId);

    if (!existingConfig) {
      throw new Error(`Config not found for agent: ${agentId}`);
    }

    // 深度合併
    const updatedConfig = AgentConfigValidator.deepMerge(existingConfig, partialConfig);

    // 保存並返回
    return this.saveConfig(agentId, updatedConfig);
  }

  /**
   * 刪除配置
   * @param {string} agentId
   */
  deleteConfig(agentId) {
    try {
      this.db.run('DELETE FROM agent_configs WHERE agent_id = ?', [agentId]);
      console.log(`✓ Config deleted for agent: ${agentId}`);
    } catch (error) {
      console.error(`❌ Failed to delete config for ${agentId}:`, error.message);
      throw error;
    }
  }

  /**
   * 獲取所有配置
   * @returns {Object[]}
   */
  getAllConfigs() {
    try {
      const rows = this.db.all('SELECT config FROM agent_configs');
      return rows.map(row => JSON.parse(row.config));
    } catch (error) {
      console.error('❌ Failed to get all configs:', error.message);
      return [];
    }
  }

  /**
   * 檢查配置是否存在
   * @param {string} agentId
   * @returns {boolean}
   */
  configExists(agentId) {
    try {
      const row = this.db.get(
        'SELECT 1 FROM agent_configs WHERE agent_id = ?',
        [agentId]
      );
      return !!row;
    } catch (error) {
      return false;
    }
  }

  /**
   * 獲取配置統計信息
   * @returns {Object}
   */
  getStats() {
    try {
      const total = this.db.get('SELECT COUNT(*) as count FROM agent_configs');
      const configs = this.getAllConfigs();

      const providerCounts = configs.reduce((acc, config) => {
        const type = config.llmProvider?.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return {
        total: total.count,
        byProvider: providerCounts
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error.message);
      return { total: 0, byProvider: {} };
    }
  }
}

export default ConfigManager;
