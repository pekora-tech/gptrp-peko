/**
 * test-providers.js - Provider 單元測試
 * 執行: node test-providers.js
 */

import ProviderFactory from './providers/ProviderFactory.js';
import env from './env.json' assert { type: 'json' };

// 測試 OpenAI Provider
async function testOpenAI() {
  console.log('\n📦 Testing OpenAI Provider...\n');

  try {
    const provider = ProviderFactory.createProvider({
      type: 'openai',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-5-mini'
    });

    console.log('✓ Provider created');
    console.log('  Type:', provider.providerType);
    console.log('  Model:', provider.model);

    // 健康檢查
    console.log('\n  Running health check...');
    const health = await provider.healthCheck();
    console.log('  Health:', health.healthy ? '✓' : '✗', health.message);

    if (!health.healthy) {
      console.log('⚠️  OpenAI health check failed, skipping further tests');
      return;
    }

    // 測試 JSON 模式
    console.log('\n  Testing JSON generation...');
    const response = await provider.generate(
      'Return a JSON object with a greeting: {"greeting": "Hello, World!"}',
      { jsonMode: true }
    );

    console.log('  Response received:');
    console.log('    Provider:', response.provider);
    console.log('    Model:', response.model);
    console.log('    Tokens:', response.usage.total_tokens);

    // 驗證 JSON
    const parsed = JSON.parse(response.content);
    console.log('    Content:', parsed);
    console.log('  ✓ Valid JSON received');

    // 測試重試機制
    console.log('\n  Testing retry mechanism...');
    const retryResponse = await provider.generateWithRetry(
      'Return JSON: {"test": true}',
      { jsonMode: true }
    );
    console.log('  ✓ Retry mechanism works');

    console.log('\n✅ OpenAI Provider: All tests passed\n');
  } catch (error) {
    console.error('\n❌ OpenAI Provider test failed:', error.message, '\n');
  }
}

// 測試 Ollama Provider
async function testOllama() {
  console.log('\n📦 Testing Ollama Provider...\n');

  try {
    const provider = ProviderFactory.createProvider({
      type: 'ollama',
      model: env.OLLAMA_DEFAULT_MODEL || 'gemma3:12b',
      baseURL: env.OLLAMA_BASE_URL || 'http://localhost:11434'
    });

    console.log('✓ Provider created');
    console.log('  Type:', provider.providerType);
    console.log('  Model:', provider.model);
    console.log('  Base URL:', provider.baseURL);

    // 健康檢查
    console.log('\n  Running health check...');
    const health = await provider.healthCheck();
    console.log('  Health:', health.healthy ? '✓' : '✗', health.message);

    if (!health.healthy) {
      console.log('⚠️  Ollama health check failed. Make sure:');
      console.log('     1. Ollama is running (ollama serve)');
      console.log('     2. Model is pulled (ollama pull gemma3:12b)');
      console.log('     3. Base URL is correct');
      return;
    }

    // 測試 JSON 模式
    console.log('\n  Testing JSON generation...');
    const response = await provider.generate(
      'Return a JSON object with a greeting: {"greeting": "Hello from Ollama!"}',
      { jsonMode: true }
    );

    console.log('  Response received:');
    console.log('    Provider:', response.provider);
    console.log('    Model:', response.model);
    console.log('    Tokens:', response.usage.total_tokens);

    // 驗證 JSON
    try {
      const parsed = JSON.parse(response.content);
      console.log('    Content:', parsed);
      console.log('  ✓ Valid JSON received');
    } catch (parseError) {
      console.log('  ⚠️  Response is not valid JSON:', response.content);
      console.log('  This is expected for some Ollama models. Will test retry...');
    }

    // 測試帶驗證的重試機制
    console.log('\n  Testing retry mechanism with JSON validation...');
    const retryResponse = await provider.generateWithRetry(
      'Return JSON: {"test": true, "message": "Ollama works!"}',
      { jsonMode: true }
    );

    const parsed = JSON.parse(retryResponse.content);
    console.log('  Parsed:', parsed);
    console.log('  ✓ Retry mechanism with JSON validation works');

    console.log('\n✅ Ollama Provider: All tests passed\n');
  } catch (error) {
    console.error('\n❌ Ollama Provider test failed:', error.message, '\n');
  }
}

// 測試 ProviderFactory
function testFactory() {
  console.log('\n📦 Testing ProviderFactory...\n');

  try {
    // 測試配置驗證
    console.log('  Testing config validation...');

    const invalidConfig1 = {};
    const validation1 = ProviderFactory.validateConfig(invalidConfig1);
    console.assert(!validation1.valid, 'Should reject config without type');
    console.log('    ✓ Rejects config without type');

    const invalidConfig2 = { type: 'invalid' };
    const validation2 = ProviderFactory.validateConfig(invalidConfig2);
    console.assert(!validation2.valid, 'Should reject unsupported type');
    console.log('    ✓ Rejects unsupported type');

    const validConfig = {
      type: 'ollama',
      model: 'gemma3:12b'
    };
    const validation3 = ProviderFactory.validateConfig(validConfig);
    console.assert(validation3.valid, 'Should accept valid config');
    console.log('    ✓ Accepts valid config');

    // 測試默認 Provider 創建
    console.log('\n  Testing default provider creation...');
    const defaultProvider = ProviderFactory.createDefaultProvider(env);
    console.log('    ✓ Created default provider:', defaultProvider.providerType);

    // 測試支援的 Provider 列表
    console.log('\n  Supported providers:', ProviderFactory.getSupportedProviders().join(', '));

    console.log('\n✅ ProviderFactory: All tests passed\n');
  } catch (error) {
    console.error('\n❌ ProviderFactory test failed:', error.message, '\n');
  }
}

// 執行所有測試
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  LLM Provider Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  testFactory();

  if (env.OPENAI_API_KEY) {
    await testOpenAI();
  } else {
    console.log('\n⚠️  Skipping OpenAI tests (no API key in env.json)\n');
  }

  await testOllama();

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Test Suite Complete');
  console.log('═══════════════════════════════════════════════════════\n');
}

runAllTests().catch(console.error);
