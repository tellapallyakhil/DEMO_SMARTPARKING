/**
 * Finds multiple paths from startNode to endNode using a modified DFS/BFS.
 * Limits to 'limit' number of paths.
 */
function findAllPaths(graph, startNode, endNode, limit = 3) {
    const paths = [];
    const queue = [{ node: startNode, path: [startNode], weight: 0 }];

    // Adjacency format handling
    const getNeighbors = (nodeId) => {
        let neighbors = [];
        if (graph.adjacencyList instanceof Map) {
            neighbors = graph.adjacencyList.get(nodeId) || [];
        } else {
            neighbors = graph.adjacencyList[nodeId] || [];
        }
        return neighbors;
    };

    // Sort neighbors by weight to try shortest first (greedy-ish)
    // BFS with path tracking
    while (queue.length > 0 && paths.length < limit) {
        // Sort queue to prioritize lower weight (Dijkstra-like behavior for first path)
        queue.sort((a, b) => a.weight - b.weight);

        const { node, path, weight } = queue.shift();

        if (node === endNode) {
            paths.push({ path, weight });
            continue;
        }

        const neighbors = getNeighbors(node);

        for (let neighborItem of neighbors) {
            const neighborNode = neighborItem.node || neighborItem; // Handle object or string
            const edgeWeight = neighborItem.weight || 1;

            // Avoid cycles in current path
            if (!path.includes(neighborNode)) {
                queue.push({
                    node: neighborNode,
                    path: [...path, neighborNode],
                    weight: weight + edgeWeight
                });
            }
        }
    }

    // Filter to ensure we have distinct enough paths if possible, 
    // but for this grid, simple distinct simple paths are fine.
    return paths;
}

module.exports = { findAllPaths };
