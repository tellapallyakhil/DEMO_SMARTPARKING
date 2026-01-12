const layout = require('../config/layout');
const { parkingGraph } = require('../models/graph.model');

const initializeGraph = () => {
    console.log('Initializing Parking Graph...');

    // Add Nodes
    layout.nodes.forEach(node => {
        parkingGraph.addNode(node.id, node.type, node.name, node.coordinates);
    });

    // Add Edges
    layout.edges.forEach(edge => {
        parkingGraph.addEdge(edge.from, edge.to, edge.weight);
    });

    console.log(`Graph initialized with ${layout.nodes.length} nodes and ${layout.edges.length} edges.`);
};

module.exports = initializeGraph;
