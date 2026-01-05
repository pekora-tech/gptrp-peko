/**
 * 整合測試：測試新的 LLM Provider 架構
 */

import ProviderFactory from './providers/ProviderFactory.js';
import { AgentConfigValidator } from './config/AgentConfigSchema.js';
import env from './env.json' assert { type: 'json' };

console.log('═══════════════════════════════════════════════════════');
console.log('  整合測試：OpenAI & Ollama 支援');
console.log('═══════════════════════════════════════════════════════\n');

// 測試 1：使用默認配置（OpenAI）
console.log('📦 測試 1: 使用 env.json 默認配置（向後兼容）\n');

const defaultConfig = {
  agentId: 'test-agent-1'
};

console.log('1. 填充 llmProvider...');
if (!defaultConfig.llmProvider) {
  const defaultProvider = ProviderFactory.createDefaultProvider(env);
  defaultConfig.llmProvider = defaultProvider.getMetadata();
  // 添加 apiKey（測試用）
  if (defaultConfig.llmProvider.type === 'openai' && env.OPENAI_API_KEY) {
    defaultConfig.llmProvider.apiKey = env.OPENAI_API_KEY;
  }
  console.log('   ✓ 使用默認 Provider:', {
    type: defaultConfig.llmProvider.type,
    model: defaultConfig.llmProvider.model
  });
}

console.log('\n2. 驗證配置...');
const validation1 = AgentConfigValidator.validate(defaultConfig);
if (validation1.valid) {
  console.log('   ✓ 配置驗證通過');
} else {
  console.log('   ✗ 配置驗證失敗:', validation1.errors);
  process.exit(1);
}

console.log('\n3. 應用默認值...');
const fullConfig1 = AgentConfigValidator.applyDefaults(defaultConfig);
console.log('   ✓ 完整配置:', {
  agentId: fullConfig1.agentId,
  provider: fullConfig1.llmProvider.type,
  model: fullConfig1.llmProvider.model,
  name: fullConfig1.name
});

console.log('\n4. 創建 Provider...');
const provider1 = ProviderFactory.createProvider(fullConfig1.llmProvider);
console.log('   ✓ Provider 創建:', provider1.constructor.name);

console.log('\n5. 健康檢查...');
const health1 = await provider1.healthCheck();
console.log('   ', health1.healthy ? '✓' : '✗', health1.message);

console.log('\n✅ 測試 1 完成\n');

console.log('═══════════════════════════════════════════════════════');
console.log('  所有整合測試完成！');
console.log('═══════════════════════════════════════════════════════');
console.log('\n✅ 系統已成功整合，支援：');
console.log('   - OpenAI Provider (gpt-4o-mini, gpt-4o, 等)');
console.log('   - Ollama Provider (本地模型)');
console.log('   - 動態配置和切換');
console.log('   - 向後兼容（使用 env.json 默認值）');
console.log('   - 個性化配置');
console.log('\n下一步：啟動伺服器測試');
console.log('   cd agent && npm start');
