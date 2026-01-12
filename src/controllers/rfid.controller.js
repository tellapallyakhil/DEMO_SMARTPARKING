const authorizedVehicles = require('../models/vehicle.model');
const { parkingGraph } = require('../models/graph.model');
const slotManager = require('../models/slot.model');
const { findNearestSlot } = require('../algorithms/modifiedDijkstra');

const authenticateVehicle = (req, res) => {
    const { rfid } = req.body;

    if (!rfid) {
        return res.status(400).json({
            success: false,
            message: 'RFID tag is required'
        });
    }

    // 1. Validate RFID
    const vehicle = authorizedVehicles[rfid];

    if (!vehicle) {
        console.log(`Access Denied: Unknown Tag ${rfid}`);
        return res.status(401).json({
            success: false,
            authorized: false,
            message: 'Access Denied: Unauthorized Vehicle',
            command: 'DENY'
        });
    }

    console.log(`Access Granted: ${vehicle.owner} (${vehicle.plate})`);

    // 2. Find Nearest Available Slot
    const slots = slotManager.getAllSlots();
    const startNode = 'ENTRANCE';
    const allocation = findNearestSlot(parkingGraph, slots, startNode);

    if (!allocation) {
        return res.status(200).json({
            success: true,
            authorized: true,
            message: 'Welcome, but Parking Full!',
            command: 'DENY_FULL', // Or allow entry to wait? Usually deny if full.
            vehicle: vehicle
        });
    }

    // 3. Mark Slot as RESERVED (Optional refinement, but good for real systems)
    // For now, we assume user drives to it. 
    // If we want to be strict, we could mark it 'RESERVED' here.
    // For this level of complexity, let's just return the path.

    // We can also return the command to OPEN the gate here.

    res.status(200).json({
        success: true,
        authorized: true,
        message: 'Access Granted',
        command: 'OPEN_GATE',
        vehicle: vehicle,
        allocation: allocation
    });
};

module.exports = {
    authenticateVehicle
};
