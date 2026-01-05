import OpenAIProvider from './OpenAIProvider.js';
import OllamaProvider from './OllamaProvider.js';

/**
 * ProviderFactory - 工廠模式創建 LLM Provider
 */
class ProviderFactory {
  /**
   * 創建 Provider 實例
   * @param {Object} config - Provider 配置
   * @returns {BaseLLMProvider}
   */
  static createProvider(config) {
    if (!config || !config.type) {
      throw new Error('Provider config must include "type" field');
    }

    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid provider config: ${validation.errors.join(', ')}`);
    }

    switch (config.type.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(config);

      case 'ollama':
        return new OllamaProvider(config);

      default:
        throw new Error(`Unsupported provider type: ${config.type}. Supported types: openai, ollama`);
    }
  }

  /**
   * 從 env.json 創建默認 Provider（向後兼容）
   * @param {Object} env - 環境變量對象
   * @returns {BaseLLMProvider}
   */
  static createDefaultProvider(env) {
    // 檢查是否有 OpenAI 配置
    if (env.OPENAI_API_KEY) {
      console.log('📦 Creating default OpenAI provider from env.json');
      return new OpenAIProvider({
        type: 'openai',
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: env.OPENAI_TEMPERATURE || 0.7
      });
    }

    // 檢查是否有 Ollama 配置
    if (env.OLLAMA_DEFAULT_MODEL) {
      console.log('📦 Creating default Ollama provider from env.json');
      return new OllamaProvider({
        type: 'ollama',
        model: env.OLLAMA_DEFAULT_MODEL,
        baseURL: env.OLLAMA_BASE_URL || 'http://localhost:11434',
        temperature: env.OLLAMA_TEMPERATURE || 0.7
      });
    }

    throw new Error('No valid provider configuration found in env.json. Please set OPENAI_API_KEY or OLLAMA_DEFAULT_MODEL');
  }

  /**
   * 驗證 Provider 配置
   * @param {Object} config
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  static validateConfig(config) {
    const errors = [];

    if (!config.type) {
      errors.push('Provider type is required');
    }

    if (config.type && !['openai', 'ollama'].includes(config.type.toLowerCase())) {
      errors.push(`Unsupported provider type: ${config.type}`);
    }

    if (!config.model) {
      errors.push('Model is required');
    }

    // Provider 特定驗證
    if (config.type === 'openai') {
      if (!config.apiKey) {
        errors.push('OpenAI requires apiKey');
      }
    }

    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 獲取支援的 Provider 類型列表
   * @returns {string[]}
   */
  static getSupportedProviders() {
    return ['openai', 'ollama'];
  }
}

export default ProviderFactory;
