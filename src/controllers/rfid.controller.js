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

    // 1. Validate RFID and get vehicle info
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

    const vehiclePlate = vehicle.plate;
    console.log(`Verifying vehicle: ${vehicle.owner} (${vehiclePlate})`);

    // 2. Check if this vehicle has an active booking
    const allSlots = slotManager.getAllSlots();
    const existingBooking = allSlots.find(slot =>
        slot.status === 'BOOKED' &&
        slot.bookingDetails &&
        slot.bookingDetails.vehicleNumber === vehiclePlate
    );

    let allocation = null;

    if (existingBooking) {
        console.log(`[RFID] Active booking found for ${vehiclePlate} at slot ${existingBooking.id}`);

        // Use the pre-booked slot
        // Calculate path to the specific booked slot
        const startNode = 'ENTRANCE';
        const { dijkstra, buildPath } = require('../algorithms/dijkstra');
        const { distances, previous } = dijkstra(parkingGraph.adjacencyList, startNode);
        const path = buildPath(previous, existingBooking.id);

        allocation = {
            slotId: existingBooking.id,
            distance: distances[existingBooking.id],
            path: path,
            isPreBooked: true
        };

        // Optionally update status to 'RESERVED' or handle transitions
        // For now, keep it 'BOOKED' until they actually park (detected by IR sensor)
    } else {
        // 3. If no booking, find Nearest Available Slot (Standard Entry)
        console.log(`[RFID] No booking found for ${vehiclePlate}. Assigning nearest available.`);
        const startNode = 'ENTRANCE';
        allocation = findNearestSlot(parkingGraph, slotManager.getSlots(), startNode);
    }

    if (!allocation) {
        return res.status(200).json({
            success: true,
            authorized: true,
            message: 'Welcome, but Parking Full!',
            command: 'DENY_FULL',
            vehicle: vehicle
        });
    }

    // 4. Send command to ESP32 to open the gate
    res.status(200).json({
        success: true,
        authorized: true,
        message: existingBooking ? 'Welcome! Drive to your booked slot.' : 'Access Granted. Proceed to assigned slot.',
        command: 'OPEN_GATE',
        vehicle: vehicle,
        allocation: allocation
    });
};

module.exports = {
    authenticateVehicle
};
