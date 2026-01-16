/**
 * BaseLLMProvider - 抽象基類
 * 所有 LLM Provider 必須繼承此類並實現核心方法
 */
class BaseLLMProvider {
  constructor(config) {
    if (new.target === BaseLLMProvider) {
      throw new Error('BaseLLMProvider is an abstract class and cannot be instantiated directly');
    }

    this.config = config;
    this.providerType = config.type;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * 生成回應（必須實現）
   * @param {string} prompt - 輸入的 prompt
   * @param {Object} options - 選項
   * @param {boolean} options.jsonMode - 是否強制 JSON 輸出
   * @param {number} options.temperature - 溫度（覆蓋默認值）
   * @param {number} options.maxTokens - 最大 token 數
   * @returns {Promise<Object>} - { content, usage, model, provider }
   */
  async generate(prompt, options = {}) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * 健康檢查（必須實現）
   * @returns {Promise<Object>} - { healthy: boolean, message: string }
   */
  async healthCheck() {
    throw new Error('healthCheck() must be implemented by subclass');
  }

  /**
   * 驗證配置（可選實現）
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validateConfig() {
    const errors = [];

    if (!this.config.type) {
      errors.push('Provider type is required');
    }

    if (!this.config.model) {
      errors.push('Model is required');
    }

    if (this.temperature !== undefined && (this.temperature < 0 || this.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 獲取 Provider 元數據
   * @returns {Object}
   */
  getMetadata() {
    return {
      type: this.providerType,
      model: this.model,
      temperature: this.temperature,
      maxRetries: this.maxRetries
    };
  }

  /**
   * 清理和解析 JSON 響應
   * @param {string} content - LLM 返回的內容
   * @returns {Object|null}
   */
  parseJSON(content) {
    try {
      // 嘗試直接解析
      return JSON.parse(content);
    } catch (error) {
      // 使用 extract-json-from-string 作為備用
      try {
        const extract = require('extract-json-from-string');
        const extracted = extract(content);
        if (extracted && extracted.length > 0) {
          return extracted[0];
        }
      } catch (extractError) {
        console.error('JSON extraction failed:', extractError.message);
      }
      return null;
    }
  }
}

export default BaseLLMProvider;
