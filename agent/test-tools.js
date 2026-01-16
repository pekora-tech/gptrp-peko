import DatabaseManager from './database.js';
import ToolManager from './ToolManager.js';
import BehaviorExecutor from './BehaviorExecutor.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 測試配置
const TEST_DB_PATH = './test_agent_memory.db';
const AGENT_ID = 'test_agent';

// ANSI 顏色碼
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log(`\n${'='.repeat(60)}`);
  log(`Testing: ${testName}`, 'cyan');
  console.log('='.repeat(60));
}

function assert(condition, message) {
  if (condition) {
    log(`✓ ${message}`, 'green');
    return true;
  } else {
    log(`✗ ${message}`, 'red');
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 主測試函數
async function runTests() {
  let db, toolManager, executor;

  try {
    log('\n🧪 Starting Tool System Tests\n', 'blue');

    // === 測試 1: 數據庫初始化 ===
    logTest('Database Initialization');
    db = new DatabaseManager(TEST_DB_PATH);
    assert(db !== null, 'Database initialized');

    // 檢查表是否存在
    const tables = db.all(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      AND name IN ('tools', 'tool_executions', 'execution_steps', 'behavior_patterns', 'tool_proposals')
    `);
    assert(tables.length === 5, `All 5 new tables created (found ${tables.length})`);

    // === 測試 2: ToolManager 創建 ===
    logTest('ToolManager Creation');
    toolManager = new ToolManager(db, AGENT_ID);
    assert(toolManager !== null, 'ToolManager initialized');

    // === 測試 3: 載入預設工具 ===
    logTest('Loading Preset Tools');
    const presetsPath = join(__dirname, 'tools', 'presets.json');
    const presets = JSON.parse(readFileSync(presetsPath, 'utf-8'));
    log(`Found ${presets.length} preset tools`, 'yellow');

    const loadResult = toolManager.loadPresetTools(presets);
    assert(loadResult.loaded > 0, `Loaded ${loadResult.loaded} preset tools`);

    // === 測試 4: 工具查詢 ===
    logTest('Tool Query');
    const gotoBedTool = toolManager.getToolByName('goto_bed');
    assert(gotoBedTool !== null, 'Found goto_bed tool');
    assert(gotoBedTool.steps.length === 4, `goto_bed has ${gotoBedTool.steps.length} steps`);
    assert(gotoBedTool.category === 'survival', `Tool category is '${gotoBedTool.category}'`);

    // === 測試 5: 前置條件檢查 ===
    logTest('Precondition Checking');

    // 測試滿足條件的狀態
    const stateHigh = { sleepiness: 8, position: { x: 10, y: 10 } };
    const matchHigh = toolManager.checkPreconditions(gotoBedTool, stateHigh);
    assert(matchHigh === true, 'Preconditions satisfied with sleepiness=8');

    // 測試不滿足條件的狀態
    const stateLow = { sleepiness: 3, position: { x: 10, y: 10 } };
    const matchLow = toolManager.checkPreconditions(gotoBedTool, stateLow);
    assert(matchLow === false, 'Preconditions not satisfied with sleepiness=3');

    // === 測試 6: 智能工具建議 ===
    logTest('Smart Tool Suggestion');
    const suggestion = toolManager.suggestTool(stateHigh);
    assert(suggestion !== null, 'Tool suggestion generated');
    assert(suggestion.name === 'goto_bed', `Suggested tool is '${suggestion.name}'`);
    assert(suggestion.confidence > 0.9, `Confidence is ${suggestion.confidence.toFixed(2)}`);

    // === 測試 7: 工具統計更新 ===
    logTest('Tool Statistics');
    const toolId = gotoBedTool.id;
    const initialStats = db.get('SELECT success_rate, usage_count FROM tools WHERE id = ?', [toolId]);
    log(`Initial: success_rate=${initialStats.success_rate}, usage_count=${initialStats.usage_count}`, 'yellow');

    toolManager.updateToolStats(toolId, true);
    const afterSuccess = db.get('SELECT success_rate, usage_count FROM tools WHERE id = ?', [toolId]);
    assert(afterSuccess.usage_count === initialStats.usage_count + 1, 'Usage count incremented');
    log(`After success: success_rate=${afterSuccess.success_rate.toFixed(2)}, usage_count=${afterSuccess.usage_count}`, 'yellow');

    toolManager.updateToolStats(toolId, false);
    const afterFailure = db.get('SELECT success_rate, usage_count FROM tools WHERE id = ?', [toolId]);
    assert(afterFailure.success_rate < afterSuccess.success_rate, 'Success rate decreased after failure');
    log(`After failure: success_rate=${afterFailure.success_rate.toFixed(2)}, usage_count=${afterFailure.usage_count}`, 'yellow');

    // === 測試 8: BehaviorExecutor 初始化 ===
    logTest('BehaviorExecutor Initialization');
    executor = new BehaviorExecutor(db, AGENT_ID, toolManager, null);
    assert(executor !== null, 'BehaviorExecutor initialized');

    // === 測試 9: 執行記錄 ===
    logTest('Execution Recording');
    const mockState = { sleepiness: 8, position: { x: 5, y: 5 } };
    const executionId = executor.startExecution(toolId, mockState);
    assert(executionId > 0, `Execution started (ID: ${executionId})`);

    // 記錄步驟完成
    const mockStep = { type: 'test', description: 'Test step' };
    const mockResult = { success: true, data: { test: 'data' } };
    executor.recordStepCompletion(executionId, 0, mockStep, mockResult);

    const steps = db.all('SELECT * FROM execution_steps WHERE execution_id = ?', [executionId]);
    assert(steps.length === 1, `Recorded ${steps.length} step(s)`);
    assert(steps[0].status === 'completed', `Step status is '${steps[0].status}'`);

    // 完成執行
    executor.completeExecution(executionId, true);
    const execution = db.get('SELECT status FROM tool_executions WHERE id = ?', [executionId]);
    assert(execution.status === 'completed', `Execution status is '${execution.status}'`);

    // === 測試 10: 工具提議表 ===
    logTest('Tool Proposals');
    const proposalData = {
      name: 'test_tool',
      description: 'A test tool',
      category: 'test',
      steps: []
    };

    const proposalResult = db.run(`
      INSERT INTO tool_proposals (agent_id, proposal_data, status)
      VALUES (?, ?, 'pending')
    `, [AGENT_ID, JSON.stringify(proposalData)]);

    assert(proposalResult.lastInsertRowid > 0, 'Tool proposal created');

    const proposals = db.all('SELECT * FROM tool_proposals WHERE agent_id = ?', [AGENT_ID]);
    assert(proposals.length === 1, `Found ${proposals.length} proposal(s)`);

    // === 測試 11: 獲取可用工具（For Prompt）===
    logTest('Tools for AI Prompt');
    const toolsForPrompt = toolManager.getAvailableToolsForPrompt(stateHigh);
    assert(Object.keys(toolsForPrompt).length > 0, `Found ${Object.keys(toolsForPrompt).length} tool category/categories`);

    for (const [category, tools] of Object.entries(toolsForPrompt)) {
      log(`  Category '${category}': ${tools.length} tool(s)`, 'yellow');
      tools.forEach(tool => {
        log(`    - ${tool.name}: ${tool.description} (${tool.reliability})`, 'yellow');
      });
    }

    // === 所有測試通過 ===
    log('\n' + '='.repeat(60), 'green');
    log('✓ All tests passed!', 'green');
    log('='.repeat(60) + '\n', 'green');

  } catch (error) {
    log('\n' + '='.repeat(60), 'red');
    log(`✗ Test failed: ${error.message}`, 'red');
    log('='.repeat(60) + '\n', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    // 清理
    if (db) {
      db.close();
      log('\nDatabase closed', 'yellow');
    }

    // 刪除測試數據庫
    try {
      const fs = await import('fs');
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
        log('Test database deleted\n', 'yellow');
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// 執行測試
runTests().catch(console.error);
