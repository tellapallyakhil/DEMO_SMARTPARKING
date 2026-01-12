const { parkingGraph } = require('./models/graph.model');
const slotManager = require('./models/slot.model');
const { findNearestSlot } = require('./algorithms/modifiedDijkstra');

console.log('--- Graph Nodes ---');
// Array.from to print Map keys
console.log(Array.from(parkingGraph.nodes.keys()));

console.log('--- Graph Edges (ENTRANCE) ---');
console.log(parkingGraph.adjacencyList.get('ENTRANCE'));

const slots = slotManager.getSlots();
console.log('--- Slots Status (S1) ---');
console.log(slots['S1']);

console.log('--- Finding Path ---');
try {
    const result = findNearestSlot(parkingGraph, slots, 'ENTRANCE');
    console.log('Result:', JSON.stringify(result, null, 2));
} catch (e) {
    console.error('Error:', e);
}
