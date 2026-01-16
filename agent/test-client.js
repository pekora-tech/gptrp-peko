import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('ws open');
  ws.send(JSON.stringify({ type: 'create_agent', agent_id: 'test-agent' }));
});

ws.on('message', (m) => {
  console.log('recv', m.toString());

  // Request next move (this will trigger the server to call OpenAI)
  ws.send(JSON.stringify({
    type: 'requestNextMove',
    agent_id: 'test-agent',
    position: { x: 0, y: 0 },
    surroundings: [],
    sleepiness: 0
  }));

  // close soon after
  setTimeout(() => ws.close(), 2000);
});

ws.on('error', (err) => console.error('ws error', err));
ws.on('close', () => console.log('ws closed'));
