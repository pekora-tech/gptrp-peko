import React, { useState, useEffect } from 'react';
import './AgentConfigPanel.css';

const AgentConfigPanel = ({ onCreateAgent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState('custom');
  const [mode, setMode] = useState('edit'); // 'edit' or 'create'
  const [existingAgents, setExistingAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('agent1'); // 預設的 agent ID
  const [config, setConfig] = useState({
    agentId: 'agent1', // 預設使用 agent1
    name: '',
    llmProvider: {
      type: 'ollama', // 預設使用 Ollama 避免燒錢
      apiKey: '',
      model: 'gemma3:4b', // 預設使用較小的模型
      baseURL: 'http://localhost:11434',
      temperature: 0.7,
      maxRetries: 3
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
      description: ''
    },
    memory: {
      shortTermSize: 20,
      longTermThreshold: 7,
      locationRadius: 5
    },
    toolPreferences: {
      allowedTools: [],
      blockedTools: []
    },
    initialState: {
      position: { x: 7, y: 6 },
      bedPosition: { x: 6, y: 5 },
      spriteKey: 'player'
    }
  });

  // WebSocket 連接（用於獲取現有 Agent 配置）
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      // 請求當前 Agent 配置
      ws.send(JSON.stringify({
        type: 'get_agent_config',
        agent_id: selectedAgent
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'agent_config' && data.success) {
        // 載入現有配置
        setConfig(data.config);
        setMode('edit');
      }
    };

    return () => ws.close();
  }, [selectedAgent]);

  // 預設模板
  const templates = {
    explorer: {
      name: 'Explorer',
      llmProvider: { type: 'ollama', model: 'gemma3:4b', temperature: 0.8 },
      personality: {
        behaviorTendencies: { exploration: 90, collection: 40, social: 30, defensive: 20 },
        traits: { cautious: 20, bold: 85, curious: 90, lazy: 10 },
        description: 'A fearless explorer who loves discovering new places'
      },
      memory: { shortTermSize: 25, longTermThreshold: 6, locationRadius: 7 }
    },
    collector: {
      name: 'Collector',
      llmProvider: { type: 'ollama', model: 'gemma3:4b', temperature: 0.5 },
      personality: {
        behaviorTendencies: { exploration: 30, collection: 95, social: 20, defensive: 60 },
        traits: { cautious: 80, bold: 25, curious: 45, lazy: 30 },
        description: 'A meticulous collector focused on efficiency'
      },
      memory: { shortTermSize: 15, longTermThreshold: 8, locationRadius: 4 }
    },
    social: {
      name: 'Social',
      llmProvider: { type: 'openai', model: 'gpt-5-mini', temperature: 0.7 },
      personality: {
        behaviorTendencies: { exploration: 40, collection: 30, social: 95, defensive: 35 },
        traits: { cautious: 45, bold: 60, curious: 70, lazy: 25 },
        description: 'A friendly agent who values social connections'
      }
    },
    balanced: {
      name: 'Balanced',
      llmProvider: { type: 'openai', model: 'gpt-5-mini', temperature: 0.7 },
      personality: {
        behaviorTendencies: { exploration: 50, collection: 50, social: 50, defensive: 50 },
        traits: { cautious: 50, bold: 50, curious: 50, lazy: 50 },
        description: 'A well-balanced agent'
      }
    }
  };

  const applyTemplate = (templateName) => {
    if (templateName === 'custom') {
      return;
    }

    const template = templates[templateName];
    setConfig(prev => ({
      ...prev,
      name: template.name,
      llmProvider: {
        ...prev.llmProvider,
        ...template.llmProvider
      },
      personality: {
        behaviorTendencies: { ...prev.personality.behaviorTendencies, ...template.personality.behaviorTendencies },
        traits: { ...prev.personality.traits, ...template.personality.traits },
        description: template.personality.description || ''
      },
      memory: {
        ...prev.memory,
        ...(template.memory || {})
      }
    }));
  };

  const updateConfig = (path, value) => {
    setConfig(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let current = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!config.agentId.trim()) {
      alert('Agent ID is required');
      return;
    }

    if (config.llmProvider.type === 'openai' && !config.llmProvider.apiKey.trim()) {
      alert('OpenAI API Key is required for OpenAI provider');
      return;
    }

    // 發送更新配置到後端
    const ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'update_agent_config',
        agent_id: config.agentId,
        updates: config
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'config_updated') {
        if (data.success) {
          alert(`Agent ${config.agentId} configuration updated successfully!`);
          setIsOpen(false);
        } else {
          alert(`Failed to update configuration: ${data.message}`);
        }
      }

      ws.close();
    };

    ws.onerror = () => {
      alert('Failed to connect to server. Make sure the backend is running.');
    };
  };

  return (
    <div className={`agent-config-panel ${isOpen ? 'open' : ''}`}>
      <button className="toggle-button" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '× Close Panel' : '+ New Agent'}
      </button>

      {isOpen && (
        <div className="config-form-container">
          <h3>Configure Agent: {config.agentId}</h3>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            {mode === 'edit' ? '編輯現有 Agent 配置' : '創建新的 Agent'}
          </p>

          <form onSubmit={handleSubmit} className="config-form">
            {/* Agent ID - 鎖定不可編輯 */}
            <section className="form-section">
              <h4>Agent ID</h4>
              <input
                type="text"
                value={config.agentId}
                disabled
                style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                title="Agent ID cannot be changed"
              />
              <small style={{ color: '#666', fontSize: '11px' }}>
                正在編輯現有的 Agent，ID 無法更改
              </small>
            </section>

            {/* 模板選擇 */}
            <section className="form-section">
              <h4>Template (快速套用)</h4>
              <select
                value={currentTemplate}
                onChange={(e) => {
                  setCurrentTemplate(e.target.value);
                  applyTemplate(e.target.value);
                }}
                className="template-select"
              >
                <option value="custom">Custom</option>
                <option value="explorer">Explorer (Bold & Curious)</option>
                <option value="collector">Collector (Cautious & Efficient)</option>
                <option value="social">Social (Friendly & Outgoing)</option>
                <option value="balanced">Balanced</option>
              </select>
            </section>

            {/* 基本信息 */}
            <section className="form-section">
              <h4>Display Name</h4>
              <input
                type="text"
                placeholder="Display Name (optional)"
                value={config.name}
                onChange={(e) => updateConfig('name', e.target.value)}
              />
            </section>

            {/* LLM Provider */}
            <section className="form-section">
              <h4>LLM Provider</h4>
              <select
                value={config.llmProvider.type}
                onChange={(e) => updateConfig('llmProvider.type', e.target.value)}
              >
                <option value="ollama">Ollama (Local - 推薦，免費)</option>
                <option value="openai">OpenAI (需要 API Key，會花錢)</option>
              </select>

              {config.llmProvider.type === 'openai' && (
                <>
                  <input
                    type="password"
                    placeholder="API Key"
                    value={config.llmProvider.apiKey}
                    onChange={(e) => updateConfig('llmProvider.apiKey', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Model (e.g., gpt-5-mini)"
                    value={config.llmProvider.model}
                    onChange={(e) => updateConfig('llmProvider.model', e.target.value)}
                  />
                </>
              )}

              {config.llmProvider.type === 'ollama' && (
                <>
                  <select
                    value={config.llmProvider.model}
                    onChange={(e) => updateConfig('llmProvider.model', e.target.value)}
                  >
                    <option value="gemma3:4b">gemma3:4b (推薦 - 速度快)</option>
                    <option value="gemma3:12b">gemma3:12b (較慢但更聰明)</option>
                    <option value="llama3.2:3b">llama3.2:3b (快速)</option>
                    <option value="llama3.2:7b">llama3.2:7b (平衡)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Base URL"
                    value={config.llmProvider.baseURL}
                    onChange={(e) => updateConfig('llmProvider.baseURL', e.target.value)}
                  />
                  <small style={{ color: '#666', fontSize: '11px' }}>
                    請確保 Ollama 服務已啟動: ollama serve
                  </small>
                </>
              )}

              <label className="slider-label">
                Temperature: {config.llmProvider.temperature.toFixed(1)}
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.llmProvider.temperature}
                  onChange={(e) => updateConfig('llmProvider.temperature', parseFloat(e.target.value))}
                />
              </label>
            </section>

            {/* 行為傾向 */}
            <section className="form-section">
              <h4>Behavior Tendencies</h4>
              {Object.entries(config.personality.behaviorTendencies).map(([key, value]) => (
                <label key={key} className="slider-label">
                  {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => updateConfig(`personality.behaviorTendencies.${key}`, parseInt(e.target.value))}
                  />
                </label>
              ))}
            </section>

            {/* 性格特質 */}
            <section className="form-section">
              <h4>Personality Traits</h4>
              {Object.entries(config.personality.traits).map(([key, value]) => (
                <label key={key} className="slider-label">
                  {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => updateConfig(`personality.traits.${key}`, parseInt(e.target.value))}
                  />
                </label>
              ))}
            </section>

            {/* 自定義描述 */}
            <section className="form-section">
              <h4>Custom Description</h4>
              <textarea
                placeholder="Describe this agent's personality..."
                value={config.personality.description}
                onChange={(e) => updateConfig('personality.description', e.target.value)}
                rows="3"
              />
            </section>

            {/* 記憶設置 */}
            <section className="form-section">
              <h4>Memory Settings</h4>
              <label className="slider-label">
                Short-term Size: {config.memory.shortTermSize}
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={config.memory.shortTermSize}
                  onChange={(e) => updateConfig('memory.shortTermSize', parseInt(e.target.value))}
                />
              </label>
              <label className="slider-label">
                Long-term Threshold: {config.memory.longTermThreshold}
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.memory.longTermThreshold}
                  onChange={(e) => updateConfig('memory.longTermThreshold', parseInt(e.target.value))}
                />
              </label>
              <label className="slider-label">
                Location Radius: {config.memory.locationRadius}
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={config.memory.locationRadius}
                  onChange={(e) => updateConfig('memory.locationRadius', parseInt(e.target.value))}
                />
              </label>
            </section>

            {/* 初始狀態 */}
            <section className="form-section">
              <h4>Initial State</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="number"
                  placeholder="Start X"
                  value={config.initialState.position.x}
                  onChange={(e) => updateConfig('initialState.position.x', parseInt(e.target.value))}
                  style={{ width: '50%' }}
                />
                <input
                  type="number"
                  placeholder="Start Y"
                  value={config.initialState.position.y}
                  onChange={(e) => updateConfig('initialState.position.y', parseInt(e.target.value))}
                  style={{ width: '50%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input
                  type="number"
                  placeholder="Bed X"
                  value={config.initialState.bedPosition.x}
                  onChange={(e) => updateConfig('initialState.bedPosition.x', parseInt(e.target.value))}
                  style={{ width: '50%' }}
                />
                <input
                  type="number"
                  placeholder="Bed Y"
                  value={config.initialState.bedPosition.y}
                  onChange={(e) => updateConfig('initialState.bedPosition.y', parseInt(e.target.value))}
                  style={{ width: '50%' }}
                />
              </div>
            </section>

            <button type="submit" className="create-button">
              {mode === 'edit' ? '更新配置' : 'Create Agent'}
            </button>

            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fffbea', borderRadius: '4px' }}>
              <strong>💡 提示：</strong>
              <ul style={{ fontSize: '12px', marginTop: '5px', paddingLeft: '20px' }}>
                <li>使用 Ollama 可以免費運行，不會燒錢</li>
                <li>修改配置後，Agent 會在下次決策時使用新配置</li>
                <li>建議：exploration 高的 Agent 會更愛探索</li>
                <li>建議：cautious 高的 Agent 會更謹慎行動</li>
              </ul>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AgentConfigPanel;
