/**
 * AgentConfigSchema - Agent 配置 Schema 定義和驗證器
 */

/**
 * Agent 配置驗證器
 */
export class AgentConfigValidator {
  /**
   * 驗證完整配置
   * @param {Object} config
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  static validate(config) {
    const errors = [];

    // 必填字段
    if (!config.agentId) {
      errors.push('agentId is required');
    }

    if (!config.llmProvider) {
      errors.push('llmProvider is required');
    }

    // LLM Provider 驗證
    if (config.llmProvider) {
      const providerErrors = this.validateProvider(config.llmProvider);
      errors.push(...providerErrors);
    }

    // 個性化驗證
    if (config.personality) {
      const personalityErrors = this.validatePersonality(config.personality);
      errors.push(...personalityErrors);
    }

    // 記憶配置驗證
    if (config.memory) {
      const memoryErrors = this.validateMemory(config.memory);
      errors.push(...memoryErrors);
    }

    // 工具偏好驗證
    if (config.toolPreferences) {
      const toolErrors = this.validateToolPreferences(config.toolPreferences);
      errors.push(...toolErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證 LLM Provider 配置
   */
  static validateProvider(provider) {
    const errors = [];

    if (!provider.type) {
      errors.push('llmProvider.type is required');
    }

    if (provider.type && !['openai', 'ollama'].includes(provider.type.toLowerCase())) {
      errors.push(`Invalid provider type: ${provider.type}. Must be 'openai' or 'ollama'`);
    }

    if (!provider.model) {
      errors.push('llmProvider.model is required');
    }

    if (provider.type === 'openai' && !provider.apiKey) {
      errors.push('OpenAI provider requires apiKey');
    }

    if (provider.temperature !== undefined) {
      if (typeof provider.temperature !== 'number' || provider.temperature < 0 || provider.temperature > 2) {
        errors.push('llmProvider.temperature must be between 0 and 2');
      }
    }

    if (provider.maxRetries !== undefined) {
      if (!Number.isInteger(provider.maxRetries) || provider.maxRetries < 1 || provider.maxRetries > 10) {
        errors.push('llmProvider.maxRetries must be an integer between 1 and 10');
      }
    }

    return errors;
  }

  /**
   * 驗證個性化配置
   */
  static validatePersonality(personality) {
    const errors = [];

    if (personality.behaviorTendencies) {
      const tendencyErrors = this.validateRange(
        personality.behaviorTendencies,
        'personality.behaviorTendencies',
        0,
        100
      );
      errors.push(...tendencyErrors);
    }

    if (personality.traits) {
      const traitErrors = this.validateRange(
        personality.traits,
        'personality.traits',
        0,
        100
      );
      errors.push(...traitErrors);
    }

    if (personality.description !== undefined && typeof personality.description !== 'string') {
      errors.push('personality.description must be a string');
    }

    return errors;
  }

  /**
   * 驗證記憶配置
   */
  static validateMemory(memory) {
    const errors = [];

    if (memory.shortTermSize !== undefined) {
      if (!Number.isInteger(memory.shortTermSize) || memory.shortTermSize < 5 || memory.shortTermSize > 100) {
        errors.push('memory.shortTermSize must be an integer between 5 and 100');
      }
    }

    if (memory.longTermThreshold !== undefined) {
      if (!Number.isInteger(memory.longTermThreshold) || memory.longTermThreshold < 1 || memory.longTermThreshold > 10) {
        errors.push('memory.longTermThreshold must be an integer between 1 and 10');
      }
    }

    if (memory.locationRadius !== undefined) {
      if (!Number.isInteger(memory.locationRadius) || memory.locationRadius < 1 || memory.locationRadius > 20) {
        errors.push('memory.locationRadius must be an integer between 1 and 20');
      }
    }

    return errors;
  }

  /**
   * 驗證工具偏好配置
   */
  static validateToolPreferences(toolPreferences) {
    const errors = [];

    if (toolPreferences.allowedTools !== undefined && !Array.isArray(toolPreferences.allowedTools)) {
      errors.push('toolPreferences.allowedTools must be an array');
    }

    if (toolPreferences.blockedTools !== undefined && !Array.isArray(toolPreferences.blockedTools)) {
      errors.push('toolPreferences.blockedTools must be an array');
    }

    if (toolPreferences.preferredCategories !== undefined && !Array.isArray(toolPreferences.preferredCategories)) {
      errors.push('toolPreferences.preferredCategories must be an array');
    }

    return errors;
  }

  /**
   * 驗證數值範圍
   */
  static validateRange(obj, path, min, max) {
    const errors = [];

    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (value < min || value > max) {
          errors.push(`${path}.${key} must be between ${min} and ${max}`);
        }
      }
    });

    return errors;
  }

  /**
   * 應用默認值
   */
  static applyDefaults(config) {
    const defaults = {
      name: config.name || 'Unnamed Agent',
      personality: {
        behaviorTendencies: {
          exploration: 50,
          collection: 50,
          social: 50,
          defensive: 50
        },
        traits: {
          cautious: 50,
          bold: 50,
          curious: 50,
          lazy: 50
        },
        description: ''
      },
      memory: {
        shortTermSize: 20,
        longTermThreshold: 7,
        locationRadius: 5
      },
      toolPreferences: {
        allowedTools: [],
        blockedTools: [],
        preferredCategories: []
      },
      initialState: {
        position: { x: 7, y: 6 },
        bedPosition: { x: 6, y: 5 },
        spriteKey: 'player'
      }
    };

    return this.deepMerge(defaults, config);
  }

  /**
   * 深度合併對象
   */
  static deepMerge(target, source) {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }
}

/**
 * 默認配置模板
 */
export const DEFAULT_CONFIGS = {
  // 探索者模板（OpenAI）
  explorer: {
    name: 'Explorer',
    llmProvider: {
      type: 'openai',
      model: 'gpt-5-mini',
      temperature: 0.8
    },
    personality: {
      behaviorTendencies: {
        exploration: 90,
        collection: 40,
        social: 30,
        defensive: 20
      },
      traits: {
        cautious: 20,
        bold: 85,
        curious: 90,
        lazy: 10
      },
      description: 'A fearless explorer who loves discovering new places and taking risks'
    },
    memory: {
      shortTermSize: 25,
      longTermThreshold: 6,
      locationRadius: 7
    }
  },

  // 收集者模板（Ollama）
  collector: {
    name: 'Collector',
    llmProvider: {
      type: 'ollama',
      model: 'gemma3:12b',
      baseURL: 'http://localhost:11434',
      temperature: 0.5
    },
    personality: {
      behaviorTendencies: {
        exploration: 30,
        collection: 95,
        social: 20,
        defensive: 60
      },
      traits: {
        cautious: 80,
        bold: 25,
        curious: 45,
        lazy: 30
      },
      description: 'A meticulous collector focused on efficiency and safety'
    },
    memory: {
      shortTermSize: 15,
      longTermThreshold: 8,
      locationRadius: 4
    },
    toolPreferences: {
      preferredCategories: ['farming', 'survival']
    }
  },

  // 社交型模板
  social: {
    name: 'Social Agent',
    llmProvider: {
      type: 'openai',
      model: 'gpt-5-mini',
      temperature: 0.7
    },
    personality: {
      behaviorTendencies: {
        exploration: 40,
        collection: 30,
        social: 95,
        defensive: 35
      },
      traits: {
        cautious: 45,
        bold: 60,
        curious: 70,
        lazy: 25
      },
      description: 'A friendly and outgoing agent who values social connections'
    }
  },

  // 平衡型模板
  balanced: {
    name: 'Balanced Agent',
    llmProvider: {
      type: 'openai',
      model: 'gpt-5-mini',
      temperature: 0.7
    },
    personality: {
      behaviorTendencies: {
        exploration: 50,
        collection: 50,
        social: 50,
        defensive: 50
      },
      traits: {
        cautious: 50,
        bold: 50,
        curious: 50,
        lazy: 50
      },
      description: 'A well-balanced agent with no particular preference'
    }
  }
};
