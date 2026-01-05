import React, { useEffect, useRef, useState } from "react";
import Phaser from 'phaser';
import './App.css';
import GridEngine from "grid-engine";
import AIConsole from './AIConsole';
import TaskManager from './TaskManager';
import AgentConfigPanel from './AgentConfigPanel';  // 新增

import preload from './preload';
import create from './create';
import update from './update';

function App() {
  const gameRef = useRef(null);
  const [aiLogs, setAiLogs] = useState([]);
  const [tasks, setTasks] = useState([]);

  // 新增：處理動態創建 Agent
  const handleCreateAgent = (config) => {
    console.log('Creating agent with config:', config);
    // TODO: 實現動態添加 Agent 到場景
    // 可以通過 window.__GRID_ENGINE__ 和 window.__AGENTS__ 訪問
    alert(`Agent ${config.agentId} created! Refresh the page to see it.`);
  };

  useEffect(() => {
    // Set up global callback for AI logs
    window.__AI_LOG_CALLBACK__ = (logData) => {
      setAiLogs((prevLogs) => [...prevLogs, logData]);
    };

    // Set up global callback for task updates
    window.__TASK_UPDATE_CALLBACK__ = (taskData) => {
      setTasks((prevTasks) => [...prevTasks, taskData]);
    };

    if (gameRef.current === null) {
      gameRef.current = new Phaser.Game({
        title: "GPTRPG",
        render: {
          antialias: false,
        },
        type: Phaser.AUTO,
        physics: {
          default: "arcade",
        },
        plugins: {
          scene: [
            {
              key: "gridEngine",
              plugin: GridEngine,
              mapping: "gridEngine",
            },
          ],
        },
        scene: {
          preload,
          create,
          update,
        },
        scale: {
          width: window.innerWidth,
          height: window.innerHeight,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        parent: "game",
        backgroundColor: "#48C4F8",
      });
    }

    // Cleanup on unmount
    return () => {
      delete window.__AI_LOG_CALLBACK__;
      delete window.__TASK_UPDATE_CALLBACK__;
    };
  }, []);

  const handleAddTask = (task) => {
    setTasks((prevTasks) => [...prevTasks, task]);
  };

  const handleUpdateTask = (index, updates) => {
    setTasks((prevTasks) => {
      const newTasks = [...prevTasks];
      newTasks[index] = { ...newTasks[index], ...updates };
      return newTasks;
    });
  };

  const handleDeleteTask = (index) => {
    setTasks((prevTasks) => prevTasks.filter((_, i) => i !== index));
  };

  return (
    <>
      <div id="game"></div>
      <AIConsole logs={aiLogs} />
      <TaskManager
        tasks={tasks}
        onAddTask={handleAddTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
      <AgentConfigPanel onCreateAgent={handleCreateAgent} />  {/* 新增 */}
    </>
  );
}

export default App;
