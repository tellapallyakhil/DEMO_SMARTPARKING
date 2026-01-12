class Graph {
    constructor() {
        // Initialize Nodes
        this.nodes = new Map();
        this.adjacencyList = new Map();

        // Add Nodes manually for now to match UI
        // Main Artery
        this.addNode('ENTRANCE', 'ENTRY', 'Entrance');
        this.addNode('I1', 'JUNCTION', 'Main Fork');

        // Lane Junctions
        this.addNode('I2', 'JUNCTION', 'Top Lane Start');
        this.addNode('I3', 'JUNCTION', 'Mid Lane Start');
        this.addNode('I4', 'JUNCTION', 'Bot Lane Start');

        // Slots
        for (let i = 1; i <= 9; i++) {
            this.addNode(`S${i}`, 'SLOT', `Slot ${i}`);
        }

        // --- EDGES / CONNECTIONS ---

        // Entrance to Fork
        this.addEdge('ENTRANCE', 'I1', 10);

        // Fork to Lanes
        this.addEdge('I1', 'I2', 10);
        this.addEdge('I1', 'I3', 10);
        this.addEdge('I1', 'I4', 10);

        // Lane 1 (Top): I2 -> S1 -> S2 -> S3
        this.addEdge('I2', 'S1', 10);
        this.addEdge('S1', 'S2', 10);
        this.addEdge('S2', 'S3', 10);

        // Lane 2 (Mid): I3 -> S4 -> S5 -> S6
        this.addEdge('I3', 'S4', 10);
        this.addEdge('S4', 'S5', 10);
        this.addEdge('S5', 'S6', 10);

        // Lane 3 (Bot): I4 -> S7 -> S8 -> S9
        this.addEdge('I4', 'S7', 10);
        this.addEdge('S7', 'S8', 10);
        this.addEdge('S8', 'S9', 10);
    }

    addNode(id, type = 'JUNCTION', name = '', coordinates = { x: 0, y: 0 }) {
        this.nodes.set(id, { id, type, name, coordinates });
        this.adjacencyList.set(id, []);
    }

    addEdge(from, to, weight) {
        if (!this.nodes.has(from) || !this.nodes.has(to)) {
            // Check if we can lazy-add nodes? No, better be strict. 
            // Actually, in the constructor I called addNode first so strict check is fine.
            console.error(`Error: Nodes ${from} or ${to} do not exist.`);
            return;
        }
        this.adjacencyList.get(from).push({ node: to, weight });
        this.adjacencyList.get(to).push({ node: from, weight });
    }

    getGraph() {
        const nodesObj = Object.fromEntries(this.nodes);
        const adjObj = {};
        for (let [key, value] of this.adjacencyList) {
            adjObj[key] = value;
        }
        return { nodes: nodesObj, adjacencyList: adjObj };
    }
}

const parkingGraph = new Graph();
module.exports = { parkingGraph, Graph };
