function dijkstra(graph, startNode, blockedNodes = []) {
  const distances = {};
  const previous = {};
  const visited = new Set();

  // Handle Map (from our Graph model) or Object
  // If Map, we use keys(). If Object, keys().
  let nodes = [];
  if (graph instanceof Map) {
    nodes = Array.from(graph.keys());
  } else {
    nodes = Object.keys(graph);
  }

  nodes.forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  distances[startNode] = 0;

  while (visited.size < nodes.length) {
    let currentNode = null;
    let minDistance = Infinity;

    // Find unvisited node with smallest distance
    for (let node of nodes) { // Iterate over known nodes, not just distances keys (though they match)
      if (!visited.has(node) && distances[node] < minDistance) {
        minDistance = distances[node];
        currentNode = node;
      }
    }

    if (currentNode === null) break;
    visited.add(currentNode);

    // Get neighbors
    let neighbors = [];
    if (graph instanceof Map) {
      neighbors = graph.get(currentNode) || [];
    } else {
      neighbors = graph[currentNode] || [];
    }

    for (let neighbor of neighbors) {
      if (blockedNodes.includes(neighbor.node)) continue;

      const newDistance = distances[currentNode] + neighbor.weight;
      if (newDistance < distances[neighbor.node]) {
        distances[neighbor.node] = newDistance;
        previous[neighbor.node] = currentNode;
      }
    }
  }

  return { distances, previous };
}

function buildPath(previous, target) {
  const path = [];
  let current = target;

  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  return path;
}

module.exports = { dijkstra, buildPath };
