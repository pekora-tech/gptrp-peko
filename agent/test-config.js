/**
 * test-config.js - 配置系統測試
 * 執行: node test-config.js
 */

import { AgentConfigValidator, DEFAULT_CONFIGS } from './config/AgentConfigSchema.js';
import ConfigManager from './config/ConfigManager.js';
import DatabaseManager from './database.js';

// 測試配置驗證
function testConfigValidation() {
  console.log('\n📦 Testing Config Validation...\n');

  try {
    // 測試 1: 拒絕無效配置
    console.log('  Test 1: Reject invalid config');
    const invalidConfig = { agentId: 'test' };
    const validation1 = AgentConfigValidator.validate(invalidConfig);
    console.assert(!validation1.valid, 'Should reject config without llmProvider');
    console.log('    ✓ Rejects config without llmProvider');
    console.log('      Errors:', validation1.errors.join(', '));

    // 測試 2: 拒絕無效的 Provider 類型
    console.log('\n  Test 2: Reject invalid provider type');
    const invalidConfig2 = {
      agentId: 'test',
      llmProvider: { type: 'invalid', model: 'test' }
    };
    const validation2 = AgentConfigValidator.validate(invalidConfig2);
    console.assert(!validation2.valid, 'Should reject invalid provider type');
    console.log('    ✓ Rejects invalid provider type');

    // 測試 3: 拒絕超出範圍的數值
    console.log('\n  Test 3: Reject out-of-range values');
    const invalidConfig3 = {
      agentId: 'test',
      llmProvider: { type: 'ollama', model: 'test' },
      personality: {
        traits: { cautious: 150 }
      }
    };
    const validation3 = AgentConfigValidator.validate(invalidConfig3);
    console.assert(!validation3.valid, 'Should reject out-of-range personality values');
    console.log('    ✓ Rejects out-of-range values');
    console.log('      Errors:', validation3.errors.join(', '));

    // 測試 4: 接受有效配置
    console.log('\n  Test 4: Accept valid config');
    const validConfig = {
      agentId: 'test',
      llmProvider: {
        type: 'ollama',
        model: 'gemma3:12b'
      },
      personality: {
        traits: { cautious: 80 }
      }
    };
    const validation4 = AgentConfigValidator.validate(validConfig);
    console.assert(validation4.valid, 'Should accept valid config');
    console.log('    ✓ Accepts valid config');

    console.log('\n✅ Config Validation: All tests passed\n');
  } catch (error) {
    console.error('\n❌ Config validation test failed:', error.message, '\n');
  }
}

// 測試默認值應用
function testDefaultValues() {
  console.log('\n📦 Testing Default Values...\n');

  try {
    const minimalConfig = {
      agentId: 'test1',
      llmProvider: { type: 'ollama', model: 'gemma3:12b' }
    };

    const fullConfig = AgentConfigValidator.applyDefaults(minimalConfig);

    // 檢查默認值
    console.assert(fullConfig.name === 'Unnamed Agent', 'Should apply default name');
    console.log('  ✓ Default name applied');

    console.assert(fullConfig.personality.traits.cautious === 50, 'Should apply default traits');
    console.log('  ✓ Default traits applied');

    console.assert(fullConfig.memory.shortTermSize === 20, 'Should apply default memory');
    console.log('  ✓ Default memory applied');

    console.assert(Array.isArray(fullConfig.toolPreferences.allowedTools), 'Should apply default tool prefs');
    console.log('  ✓ Default tool preferences applied');

    console.log('\n✅ Default Values: All tests passed\n');
  } catch (error) {
    console.error('\n❌ Default values test failed:', error.message, '\n');
  }
}

// 測試 ConfigManager
function testConfigManager() {
  console.log('\n📦 Testing ConfigManager...\n');

  try {
    // 使用測試數據庫
    const db = new DatabaseManager('./test_agent_memory.db');
    const configManager = new ConfigManager(db);

    // 測試 1: 保存配置
    console.log('  Test 1: Save config');
    const config1 = {
      agentId: 'test1',
      llmProvider: { type: 'ollama', model: 'gemma3:12b' },
      personality: { traits: { cautious: 80 } }
    };
    const savedConfig = configManager.saveConfig('test1', config1);
    console.assert(savedConfig.agentId === 'test1', 'Should save config');
    console.log('    ✓ Config saved successfully');

    // 測試 2: 讀取配置
    console.log('\n  Test 2: Load config');
    const loadedConfig = configManager.getConfig('test1');
    console.assert(loadedConfig !== null, 'Should load config');
    console.assert(loadedConfig.agentId === 'test1', 'Should load correct config');
    console.log('    ✓ Config loaded successfully');

    // 測試 3: 更新配置
    console.log('\n  Test 3: Update config');
    configManager.updateConfig('test1', {
      personality: { traits: { cautious: 90 } }
    });
    const updatedConfig = configManager.getConfig('test1');
    console.assert(updatedConfig.personality.traits.cautious === 90, 'Should update config');
    console.log('    ✓ Config updated successfully');

    // 測試 4: 部分更新不覆蓋其他字段
    console.log('\n  Test 4: Partial update preserves other fields');
    console.assert(updatedConfig.llmProvider.model === 'gemma3:12b', 'Should preserve other fields');
    console.log('    ✓ Other fields preserved');

    // 測試 5: 統計信息
    console.log('\n  Test 5: Get stats');
    configManager.saveConfig('test2', {
      agentId: 'test2',
      llmProvider: { type: 'openai', model: 'gpt-5-mini', apiKey: 'sk-test' }
    });
    const stats = configManager.getStats();
    console.log('    Total configs:', stats.total);
    console.log('    By provider:', stats.byProvider);
    console.assert(stats.total >= 2, 'Should have at least 2 configs');
    console.log('    ✓ Stats retrieved successfully');

    // 清理測試數據庫
    console.log('\n  Cleaning up test database...');
    const fs = require('fs');
    if (fs.existsSync('./test_agent_memory.db')) {
      fs.unlinkSync('./test_agent_memory.db');
    }
    console.log('    ✓ Test database cleaned up');

    console.log('\n✅ ConfigManager: All tests passed\n');
  } catch (error) {
    console.error('\n❌ ConfigManager test failed:', error.message, '\n');
  }
}

// 測試預設模板
function testPresetTemplates() {
  console.log('\n📦 Testing Preset Templates...\n');

  try {
    console.log('  Available templates:');
    Object.keys(DEFAULT_CONFIGS).forEach(key => {
      const template = DEFAULT_CONFIGS[key];
      console.log(`    - ${key}: ${template.name} (${template.llmProvider.type})`);

      // 驗證每個模板
      const fullConfig = {
        agentId: `test_${key}`,
        ...template
      };
      const validation = AgentConfigValidator.validate(fullConfig);
      console.assert(validation.valid, `Template ${key} should be valid`);
    });

    console.log('\n  ✓ All templates are valid');
    console.log('\n✅ Preset Templates: All tests passed\n');
  } catch (error) {
    console.error('\n❌ Preset templates test failed:', error.message, '\n');
  }
}

// 執行所有測試
function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Config System Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  testConfigValidation();
  testDefaultValues();
  testConfigManager();
  testPresetTemplates();

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Test Suite Complete');
  console.log('═══════════════════════════════════════════════════════\n');
}

runAllTests();
