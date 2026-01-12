const { dijkstra, buildPath } = require('../algorithms/dijkstra');

function findNearestAvailableSlot(graph, slots, entryNode) {
  const blockedNodes = Object.keys(slots).filter(
    slotId => slots[slotId] === 'OCCUPIED'
  );

  const { distances, previous } = dijkstra(graph, entryNode, blockedNodes);

  let nearestSlot = null;
  let shortestDistance = Infinity;

  for (let slotId in slots) {
    if (slots[slotId] === 'FREE' && distances[slotId] < shortestDistance) {
      nearestSlot = slotId;
      shortestDistance = distances[slotId];
    }
  }

  if (!nearestSlot) {
    return null;
  }

  return {
    slotId: nearestSlot,
    path: buildPath(previous, nearestSlot),
    distance: shortestDistance
  };
}

module.exports = { findNearestAvailableSlot };
