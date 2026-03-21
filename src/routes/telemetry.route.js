const express = require('express');
const { 
  ingestTelemetryController,
  traceRouteController 
} = require('../controllers/telemetry.controller');

const router = express.Router();

// POST /api/telemetry - Ingest telemetry data from IoT devices
router.post('/telemetry', ingestTelemetryController);

// GET /api/v1/analytics/trace-route/:shipmentId - Trace actual route of shipment
router.get('/v1/analytics/trace-route/:shipmentId', traceRouteController);

module.exports = router;

