import React, { useState } from 'react';
import './TaskManager.css';

const TaskManager = ({ tasks, onAddTask, onUpdateTask, onDeleteTask }) => {
  const [activeTab, setActiveTab] = useState('todo');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');

  // Filter tasks by status
  const todoTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'completed');
  const errorTasks = tasks.filter(t => t.status === 'failed' || t.status === 'error');

  const handleAddTask = () => {
    if (newTaskDescription.trim()) {
      onAddTask({
        description: newTaskDescription,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setNewTaskDescription('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'in_progress':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  };

  const renderTaskList = (taskList) => {
    if (taskList.length === 0) {
      return <div className="empty-state">No tasks here</div>;
    }

    return (
      <div className="task-list">
        {taskList.map((task, index) => (
          <div key={index} className={`task-item ${task.status}`}>
            <div className="task-header">
              <span className="task-icon">{getStatusIcon(task.status)}</span>
              <span className="task-description">{task.description}</span>
              <button
                className="task-delete-btn"
                onClick={() => onDeleteTask(index)}
                title="Delete task"
              >
                ×
              </button>
            </div>
            {task.createdAt && (
              <div className="task-meta">
                <span className="task-time">{formatTime(task.createdAt)}</span>
                {task.toolName && <span className="task-tool">Tool: {task.toolName}</span>}
                {task.error && <span className="task-error">{task.error}</span>}
              </div>
            )}
            {isExpanded && task.details && (
              <div className="task-details">
                <pre>{JSON.stringify(task.details, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`task-manager ${isMinimized ? 'minimized' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div className="task-header" onClick={toggleMinimized}>
        <span className="task-title">Task Manager</span>
        <div className="task-controls" onClick={(e) => e.stopPropagation()}>
          <button onClick={toggleExpanded} className="expand-button">
            {isExpanded ? '−' : '+'}
          </button>
          <button onClick={toggleMinimized} className="minimize-button">
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="task-tabs">
            <button
              className={`task-tab ${activeTab === 'todo' ? 'active' : ''}`}
              onClick={() => setActiveTab('todo')}
            >
              TODO ({todoTasks.length})
            </button>
            <button
              className={`task-tab ${activeTab === 'done' ? 'active' : ''}`}
              onClick={() => setActiveTab('done')}
            >
              DONE ({doneTasks.length})
            </button>
            <button
              className={`task-tab ${activeTab === 'error' ? 'active' : ''}`}
              onClick={() => setActiveTab('error')}
            >
              ERROR ({errorTasks.length})
            </button>
          </div>

          <div className="task-content">
            {activeTab === 'todo' && (
              <>
                <div className="task-input-area">
                  <input
                    type="text"
                    className="task-input"
                    placeholder="Add a new task..."
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <button className="task-add-btn" onClick={handleAddTask}>
                    Add
                  </button>
                </div>
                {renderTaskList(todoTasks)}
              </>
            )}

            {activeTab === 'done' && renderTaskList(doneTasks)}
            {activeTab === 'error' && renderTaskList(errorTasks)}
          </div>
        </>
      )}
    </div>
  );
};

export default TaskManager;
