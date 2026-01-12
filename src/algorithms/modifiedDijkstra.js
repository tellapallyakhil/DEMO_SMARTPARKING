const { dijkstra, buildPath } = require('./dijkstra');

/**
 * Finds the nearest available slot from the start node.
 * @param {Object} graph The graph object { nodes, adjacencyList }
 * @param {Object} slots The map of slots { slotId: { status, ... } }
 * @param {string} startNode The ID of the starting node (e.g., 'ENTRANCE')
 */
function findNearestSlot(graph, slots, startNode) {
    // 1. Identify valid targets (FREE slots)
    // We only care about slots that are 'FREE'.
    // We need to know which nodes in the graph correspond to these slots.
    // Assuming slot IDs in `slots` match node IDs in `graph`.

    const freeSlots = [];
    for (const [id, slot] of Object.entries(slots)) {
        if (slot.status === 'FREE') {
            freeSlots.push(id);
        }
    }

    if (freeSlots.length === 0) {
        return null; // No slots available
    }

    // 2. Run Dijkstra to get distances to ALL nodes from startNode
    // We do NOT treat occupied slots as "blocked nodes" for the traversal itself,
    // unless the slot node implies blocking a road. 
    // Usually, a slot is a leaf node or a destination.
    // If a slot is occupied, you just can't park there, but you might drive *past* it?
    // In this simple model, slots are destinations.
    // So we just run standard Dijkstra.

    // Modification: If we wanted to avoid traffic jams, we might weight edges differently.
    // But here, "Modified" simply means "Targeting Nearest AVAILABLE".

    const { distances, previous } = dijkstra(graph.adjacencyList, startNode);

    // 3. Find the closest FREE slot
    let minDistance = Infinity;
    let nearestSlotId = null;

    console.log(`[Algorithm] Found ${freeSlots.length} free slots:`, freeSlots);

    freeSlots.forEach(slotId => {
        const d = distances[slotId];
        // console.log(`To ${slotId}: ${d}`);
        if (d !== undefined && d < minDistance) {
            minDistance = d;
            nearestSlotId = slotId;
        }
    });

    if (!nearestSlotId) {
        console.error('[Algorithm] No reachable free slots found. Check graph connectivity.');
        return null;
    }

    // 4. Build the path
    const path = buildPath(previous, nearestSlotId);

    console.log(`[Algorithm] Nearest slot: ${nearestSlotId}, Distance: ${minDistance}`);

    return {
        slotId: nearestSlotId,
        distance: minDistance,
        path: path
    };
}

module.exports = { findNearestSlot };
