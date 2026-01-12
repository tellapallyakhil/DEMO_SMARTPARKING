const { parkingGraph } = require('../models/graph.model');
const slotManager = require('../models/slot.model');
const { findNearestSlot } = require('../algorithms/modifiedDijkstra');

// Config state (in-memory for now)
let parkingConfig = {
    hourlyRate: 50,
};

const getGraphLayout = (req, res) => {
    try {
        const graphData = parkingGraph.getGraph();
        res.status(200).json({
            success: true,
            data: graphData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching graph layout',
            error: error.message
        });
    }
};

const updateSlotStatus = (req, res) => {
    const { slotId, status, action } = req.body; // action can be 'force' or 'reset'

    if (!slotId || !status) {
        return res.status(400).json({
            success: false,
            message: 'Missing slotId or status'
        });
    }

    try {
        // Determine if this is a forced update
        const isForce = action === 'force' || action === 'reset';

        const updatedSlot = slotManager.updateSlotStatus(slotId, status, isForce);
        res.status(200).json({
            success: true,
            message: 'Slot status updated successfully',
            data: updatedSlot
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const getSlots = (req, res) => {
    try {
        const slots = slotManager.getSlots();
        res.status(200).json({
            success: true,
            data: slots
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching slots',
            error: error.message
        });
    }
};

const findParkingPath = (req, res) => {
    try {
        const slots = slotManager.getSlots();
        const startNode = 'ENTRANCE'; // Default start

        const result = findNearestSlot(parkingGraph, slots, startNode);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No available parking slots found.'
            });
        }

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error calculating path',
            error: error.message
        });
    }
};

const bookSlot = (req, res) => {
    const { slotId, vehicleType, vehicleNumber, duration } = req.body;

    if (!slotId || !vehicleType || !vehicleNumber || !duration) {
        return res.status(400).json({
            success: false,
            message: 'Missing required booking details'
        });
    }

    const bookingDuration = parseFloat(duration);

    // Penalty Logic: "If you exceed one minute you have to pay penalty money for next hour"
    // This implies rounding UP to the next full hour.
    const billedHours = Math.ceil(bookingDuration);
    const isPenaltyApplied = bookingDuration % 1 > 0; // If there's a fraction of an hour

    // Base Rate: Fetch from config (locally defined in this file for now, see below)
    // Note: Since I defined the object at the bottom, I should move it up or reference it.
    // Javascript hoisting applies to 'var' but 'let' needs to be defined before usage if in same scope.
    // However, module.exports runs at end. Ideally, I should move 'parkingConfig' to top of file.
    // For now, I'll access it via the exported getParkingConfig if possible, or just move the definition UP in next step.
    // Let's assume I move 'parkingConfig' to top of file in next step.
    const rate = parkingConfig.hourlyRate;

    // Penalty Rate: implied as standard rate for now based on user request "pay for next hour"
    const cost = billedHours * rate;

    // If specific penalty logic is needed beyond rounding, we can add it here.
    // e.g. base 50 + 20 penalty fee.
    // For now, I'll stick to Math.ceil() as the interpretation of "pay for next hour".

    try {
        const bookingResult = slotManager.bookSlot(slotId, {
            vehicleType,
            vehicleNumber,
            duration: billedHours, // Store billed duration
            originalDuration: bookingDuration,
            cost,
            penaltyApplied: isPenaltyApplied
        });

        if (bookingResult) {
            res.status(200).json({
                success: true,
                message: 'Slot booked successfully',
                data: bookingResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Slot not available or invalid'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing booking',
            error: error.message
        });
    }
};

const { findAllPaths } = require('../algorithms/findAllPaths');

// ... existing imports ...

// New Controller Method
const getMultiPaths = (req, res) => {
    const { startNode, endNode } = req.body;

    if (!startNode || !endNode) {
        return res.status(400).json({ success: false, message: 'Start and End nodes required' });
    }

    try {
        const routes = findAllPaths(parkingGraph, startNode, endNode, 3);
        res.status(200).json({
            success: true,
            data: routes // Array of { path: [], weight: N }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getConfig = (req, res) => {
    res.status(200).json({ success: true, data: parkingConfig });
};

const updateConfig = (req, res) => {
    const { hourlyRate } = req.body;
    if (hourlyRate) {
        parkingConfig.hourlyRate = parseFloat(hourlyRate);
    }
    res.status(200).json({ success: true, message: 'Config updated', data: parkingConfig });
};

const cancelBooking = (req, res) => {
    const { slotId } = req.body;
    if (!slotId) {
        return res.status(400).json({ success: false, message: 'SlotId required' });
    }

    try {
        // Force update to FREE (effectively canceling)
        const updatedSlot = slotManager.updateSlotStatus(slotId, 'FREE', true);
        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: updatedSlot
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getGraphLayout,
    updateSlotStatus,
    getSlots,
    findParkingPath,
    bookSlot,
    getMultiPaths,
    getConfig,
    updateConfig,
    cancelBooking
};
