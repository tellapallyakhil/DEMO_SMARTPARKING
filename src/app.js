const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Smart Parking Backend is running'
  });
});

// Initialize Parking Layout
// Initialize Parking Layout
const initializeLayout = require('./utils/initGraph');
initializeLayout();

// Routes
const parkingRoutes = require('./routes/parking.routes');
const rfidRoutes = require('./routes/rfid.routes');

app.use('/api/parking', parkingRoutes);
app.use('/api/rfid', rfidRoutes);

module.exports = app;
