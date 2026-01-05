import OpenAI from 'openai';
import BaseLLMProvider from './BaseLLMProvider.js';

/**
 * OpenAIProvider - OpenAI API 實現
 */
class OpenAIProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey
    });

    this.baseURL = config.baseURL; // 可選：自定義 API URL
  }

  /**
   * 驗證配置
   */
  validateConfig() {
    const baseValidation = super.validateConfig();
    const errors = [...baseValidation.errors];

    if (!this.config.apiKey) {
      errors.push('OpenAI API key is required');
    }

    if (this.config.apiKey && !this.config.apiKey.startsWith('sk-')) {
      errors.push('OpenAI API key must start with "sk-"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 健康檢查
   */
  async healthCheck() {
    try {
      // 嘗試列出模型來驗證 API key
      await this.client.models.list();
      return {
        healthy: true,
        message: `OpenAI API is accessible (model: ${this.model})`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `OpenAI API error: ${error.message}`
      };
    }
  }

  /**
   * 生成回應
   */
  async generate(prompt, options = {}) {
    const apiOptions = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an intelligent AI agent. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    // JSON 模式
    if (options.jsonMode) {
      apiOptions.response_format = { type: 'json_object' };
    }

    // 溫度設定（gpt-5-mini 不支援 temperature）
    const useTemperature = !this.model.includes('gpt-5-mini');
    if (useTemperature) {
      apiOptions.temperature = options.temperature ?? this.temperature;
    }

    // Max tokens
    if (options.maxTokens) {
      apiOptions.max_tokens = options.maxTokens;
    }

    try {
      const response = await this.client.chat.completions.create(apiOptions);

      const content = response.choices[0].message.content;

      return {
        content: content,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        },
        model: this.model,
        provider: 'openai'
      };
    } catch (error) {
      console.error('❌ OpenAI API error:', error.message);
      throw error;
    }
  }

  /**
   * 帶重試的生成
   */
  async generateWithRetry(prompt, options = {}, attempt = 0) {
    if (attempt >= this.maxRetries) {
      throw new Error(`Failed to generate response after ${this.maxRetries} attempts`);
    }

    try {
      return await this.generate(prompt, options);
    } catch (error) {
      console.warn(`⚠️  Attempt ${attempt + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 指數退避
      return await this.generateWithRetry(prompt, options, attempt + 1);
    }
  }
}

export default OpenAIProvider;
