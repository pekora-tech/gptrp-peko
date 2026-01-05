import BaseLLMProvider from './BaseLLMProvider.js';

/**
 * OllamaProvider - Ollama 本地 LLM 實現
 */
class OllamaProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);

    this.baseURL = config.baseURL || 'http://localhost:11434';
  }

  /**
   * 驗證配置
   */
  validateConfig() {
    const baseValidation = super.validateConfig();
    const errors = [...baseValidation.errors];

    if (this.baseURL && !this.baseURL.startsWith('http')) {
      errors.push('Ollama baseURL must start with http:// or https://');
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
      const response = await fetch(`${this.baseURL}/api/tags`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models || [];

      // 檢查請求的模型是否存在
      const modelExists = models.some(m => m.name === this.model || m.name.startsWith(this.model));

      if (!modelExists) {
        return {
          healthy: false,
          message: `Model "${this.model}" not found. Available models: ${models.map(m => m.name).join(', ')}`
        };
      }

      return {
        healthy: true,
        message: `Ollama is accessible at ${this.baseURL} (model: ${this.model})`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Ollama connection error: ${error.message}. Make sure Ollama is running at ${this.baseURL}`
      };
    }
  }

  /**
   * 生成回應
   */
  async generate(prompt, options = {}) {
    const requestBody = {
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? this.temperature
      }
    };

    // Ollama JSON 模式
    if (options.jsonMode) {
      requestBody.format = 'json';

      // 在 prompt 中強調 JSON 要求（如果尚未包含）
      if (!prompt.toLowerCase().includes('json')) {
        requestBody.prompt = `YOU MUST RESPOND WITH VALID JSON ONLY. NO OTHER TEXT.\n\n${prompt}`;
      }
    }

    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: data.response,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: this.model,
        provider: 'ollama'
      };
    } catch (error) {
      console.error('❌ Ollama API error:', error.message);
      throw error;
    }
  }

  /**
   * 帶重試和 JSON 驗證的生成
   */
  async generateWithRetry(prompt, options = {}, attempt = 0) {
    if (attempt >= this.maxRetries) {
      throw new Error(`Failed to generate valid response after ${this.maxRetries} attempts`);
    }

    // 根據重試次數調整 prompt 強度
    let enhancedPrompt = prompt;
    if (options.jsonMode) {
      if (attempt === 0) {
        enhancedPrompt = `You must respond with valid JSON.\n\n${prompt}`;
      } else if (attempt === 1) {
        enhancedPrompt = `CRITICAL: YOU MUST ONLY RESPOND WITH VALID JSON OBJECTS. NO OTHER TEXT.\n\n${prompt}`;
      } else {
        enhancedPrompt = `SYSTEM ERROR: Previous response was not valid JSON. This is your last chance.\nONLY respond with JSON matching this exact format:\n{"action": {"type": "...", ...}, "reasoning": "..."}\n\n${prompt}`;
      }
    }

    try {
      const response = await this.generate(enhancedPrompt, options);

      // 如果是 JSON 模式，驗證 JSON
      if (options.jsonMode) {
        const parsed = this.parseJSON(response.content);
        if (!parsed) {
          throw new Error('Failed to parse JSON response');
        }
        // 返回解析後的 JSON 字符串
        response.content = JSON.stringify(parsed);
      }

      return response;
    } catch (error) {
      console.warn(`⚠️  Ollama attempt ${attempt + 1} failed: ${error.message}`);

      // 等待後重試（指數退避）
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));

      return await this.generateWithRetry(prompt, options, attempt + 1);
    }
  }
}

export default OllamaProvider;
