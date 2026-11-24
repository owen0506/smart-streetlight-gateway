import { initialState, runDemo } from './demo.js';

const state = initialState();
const folder = await runDemo(state);
for (const [mode, stats] of Object.entries(state.stats)) {
  console.log(mode, stats.connections, 'TCP connections /', stats.messages, 'messages /',
    stats.bytes, 'B /', stats.acks.length, 'fault ACKs');
}
console.log('Payload reduction with aggregation:', state.reduction.toFixed(2) + '%');
console.log('Results:', folder);
