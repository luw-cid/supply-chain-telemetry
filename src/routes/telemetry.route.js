const express = require('express');
const { 
  ingestTelemetryController,
  traceRouteController,
  routeOptimizationController
} = require('../controllers/telemetry.controller');

const router = express.Router();

// POST /api/telemetry - Ingest telemetry data from IoT devices
router.post('/telemetry', ingestTelemetryController);

// GET /api/v1/analytics/trace-route/:shipmentId - Trace actual route of shipment
router.get('/v1/analytics/trace-route/:shipmentId', traceRouteController);

// GET /api/v1/analytics/route-optimization - Find optimal routes between ports
router.get('/v1/analytics/route-optimization', routeOptimizationController);

module.exports = router;

