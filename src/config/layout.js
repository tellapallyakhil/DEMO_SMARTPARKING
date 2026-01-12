const layout = {
    nodes: [
        // Entry & Main Distributing Junction
        { id: 'ENTRANCE', type: 'ENTRANCE', name: 'Main Entrance', coordinates: { x: 50, y: 300 } },
        { id: 'MAIN_JUNCTION', type: 'JUNCTION', name: 'Distribution Point', coordinates: { x: 150, y: 300 } },

        // Lane 1 (Top) - S1, S2, S3
        { id: 'LANE1_START', type: 'JUNCTION', name: 'Lane 1 Start', coordinates: { x: 250, y: 150 } },
        { id: 'S1', type: 'SLOT', name: 'Slot 1', coordinates: { x: 350, y: 150 } },
        { id: 'S2', type: 'SLOT', name: 'Slot 2', coordinates: { x: 450, y: 150 } },
        { id: 'S3', type: 'SLOT', name: 'Slot 3', coordinates: { x: 550, y: 150 } },

        // Lane 2 (Middle) - S4, S5, S6
        { id: 'LANE2_START', type: 'JUNCTION', name: 'Lane 2 Start', coordinates: { x: 250, y: 300 } },
        { id: 'S4', type: 'SLOT', name: 'Slot 4', coordinates: { x: 350, y: 300 } },
        { id: 'S5', type: 'SLOT', name: 'Slot 5', coordinates: { x: 450, y: 300 } },
        { id: 'S6', type: 'SLOT', name: 'Slot 6', coordinates: { x: 550, y: 300 } },

        // Lane 3 (Bottom) - S7, S8, S9
        { id: 'LANE3_START', type: 'JUNCTION', name: 'Lane 3 Start', coordinates: { x: 250, y: 450 } },
        { id: 'S7', type: 'SLOT', name: 'Slot 7', coordinates: { x: 350, y: 450 } },
        { id: 'S8', type: 'SLOT', name: 'Slot 8', coordinates: { x: 450, y: 450 } },
        { id: 'S9', type: 'SLOT', name: 'Slot 9', coordinates: { x: 550, y: 450 } }
    ],
    edges: [
        // Entry to Main Split
        { from: 'ENTRANCE', to: 'MAIN_JUNCTION', weight: 10 },

        // Split to Lanes
        { from: 'MAIN_JUNCTION', to: 'LANE1_START', weight: 8 },
        { from: 'MAIN_JUNCTION', to: 'LANE2_START', weight: 5 },
        { from: 'MAIN_JUNCTION', to: 'LANE3_START', weight: 8 },

        // Lane 1 Flow
        { from: 'LANE1_START', to: 'S1', weight: 3 },
        { from: 'S1', to: 'S2', weight: 3 },
        { from: 'S2', to: 'S3', weight: 3 },

        // Lane 2 Flow
        { from: 'LANE2_START', to: 'S4', weight: 3 },
        { from: 'S4', to: 'S5', weight: 3 },
        { from: 'S5', to: 'S6', weight: 3 },

        // Lane 3 Flow
        { from: 'LANE3_START', to: 'S7', weight: 3 },
        { from: 'S7', to: 'S8', weight: 3 },
        { from: 'S8', to: 'S9', weight: 3 },

        // Vertical Interconnections (Mesh Grid)
        // Column 1
        { from: 'S1', to: 'S4', weight: 4 },
        { from: 'S4', to: 'S7', weight: 4 },

        // Column 2
        { from: 'S2', to: 'S5', weight: 4 },
        { from: 'S5', to: 'S8', weight: 4 },

        // Column 3
        { from: 'S3', to: 'S6', weight: 4 },
        { from: 'S6', to: 'S9', weight: 4 }
    ]
};

module.exports = layout;
