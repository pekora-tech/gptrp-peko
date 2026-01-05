import React, { useState, useEffect, useRef } from 'react';
import './AIConsole.css';

const AIConsole = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const consoleBodyRef = useRef(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (consoleBodyRef.current && isExpanded && !isMinimized) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [logs, isExpanded, isMinimized]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'prompt':
        return '#4A90E2';
      case 'response':
        return '#7ED321';
      case 'error':
        return '#D0021B';
      case 'warning':
        return '#F5A623';
      default:
        return '#FFFFFF';
    }
  };

  const renderLogContent = (log) => {
    switch (log.type) {
      case 'prompt':
        return (
          <div className="log-content">
            <div className="log-header">
              <span className="log-label">Model:</span> {log.model}
            </div>
            {log.context && (
              <div className="log-context">
                <span className="log-label">Context:</span>
                <div>Position: ({log.context.position?.x}, {log.context.position?.y})</div>
                <div>Sleepiness: {log.context.sleepiness}/10</div>
                {log.context.currentGoal && <div>Goal: {log.context.currentGoal}</div>}
              </div>
            )}
            {isExpanded && (
              <details className="log-details">
                <summary>Full Prompt</summary>
                <pre>{log.prompt}</pre>
              </details>
            )}
          </div>
        );
      case 'response':
        return (
          <div className="log-content">
            <div className="log-header">
              <span className="log-label">Response (Attempt {log.attempt})</span>
              {log.usage && (
                <span className="log-usage">
                  Tokens: {log.usage.total_tokens} (prompt: {log.usage.prompt_tokens}, completion: {log.usage.completion_tokens})
                </span>
              )}
            </div>
            {isExpanded && (
              <details className="log-details" open>
                <summary>AI Response</summary>
                <pre>{log.response}</pre>
              </details>
            )}
          </div>
        );
      case 'error':
        return (
          <div className="log-content">
            <span className="log-label">Error:</span> {log.error}
          </div>
        );
      case 'warning':
        return (
          <div className="log-content">
            <span className="log-label">Warning:</span> {log.message}
          </div>
        );
      default:
        return <div className="log-content">{JSON.stringify(log)}</div>;
    }
  };

  return (
    <div className={`ai-console ${isMinimized ? 'minimized' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div className="console-header" onClick={toggleMinimized}>
        <span className="console-title">AI Monitor ({logs.length} logs)</span>
        <div className="console-controls" onClick={(e) => e.stopPropagation()}>
          <button onClick={toggleExpanded} className="expand-button">
            {isExpanded ? '−' : '+'}
          </button>
          <button onClick={toggleMinimized} className="minimize-button">
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {!isMinimized && (
        <div className="console-body" ref={consoleBodyRef}>
          {logs.length === 0 ? (
            <div className="log-entry empty">Waiting for AI logs...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="log-entry" style={{ borderLeftColor: getLogColor(log.type) }}>
                <div className="log-meta">
                  <span className="log-timestamp">[{formatTimestamp(log.timestamp)}]</span>
                  <span className="log-type" style={{ color: getLogColor(log.type) }}>
                    {log.type.toUpperCase()}
                  </span>
                  <span className="log-agent">Agent: {log.agentId}</span>
                </div>
                {renderLogContent(log)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AIConsole;
