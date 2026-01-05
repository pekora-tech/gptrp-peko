import React, { useEffect, useRef, useState } from "react";
import Phaser from 'phaser';
import './App.css';
import GridEngine from "grid-engine";
import AIConsole from './AIConsole';

import preload from './preload';
import create from './create';
import update from './update';

function App() {
  const gameRef = useRef(null);
  const [aiLogs, setAiLogs] = useState([]);

  useEffect(() => {
    // Set up global callback for AI logs
    window.__AI_LOG_CALLBACK__ = (logData) => {
      setAiLogs((prevLogs) => [...prevLogs, logData]);
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
    };
  }, []);

  return (
    <>
      <div id="game"></div>
      <AIConsole logs={aiLogs} />
    </>
  );
}

export default App;
