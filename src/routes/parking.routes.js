const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parking.controller');

// Route to get the parking lot graph layout
router.get('/layout', parkingController.getGraphLayout);

// Route to update slot status (called by ESP32)
router.post('/update-slot', parkingController.updateSlotStatus);

// Route to get all slots status
router.get('/slots', parkingController.getSlots);

// Route to find nearest slot and path
router.get('/path', parkingController.findParkingPath);
router.post('/routes', parkingController.getMultiPaths); // New Route for K-Paths

// Route to book a slot
router.post('/book', parkingController.bookSlot);

// Config Routes (Advanced Admin Features)
router.get('/config', parkingController.getConfig);
router.post('/config', parkingController.updateConfig);
router.post('/cancel', parkingController.cancelBooking);

module.exports = router;
