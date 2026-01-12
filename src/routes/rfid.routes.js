const express = require('express');
const router = express.Router();
const rfidController = require('../controllers/rfid.controller');

// Route for ESP32 to send RFID data
router.post('/authenticate', rfidController.authenticateVehicle);

module.exports = router;
