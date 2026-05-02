const express = require('express');
const { 
  ingestTelemetryController,
  traceRouteController,
  routeOptimizationController
} = require('../controllers/telemetry.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const rateLimiter = require('../middlewares/rate-limiter.middleware');

const router = express.Router();

// POST /api/v1/telemetry/ingest
router.post('/v1/telemetry/ingest', authenticate, rateLimiter, ingestTelemetryController);

// GET /api/v1/analytics/trace-route/:shipmentId - Trace actual route of shipment
router.get('/v1/analytics/trace-route/:shipmentId', traceRouteController);

// GET /api/v1/analytics/route-optimization - Find optimal routes between ports
router.get('/v1/analytics/route-optimization', routeOptimizationController);

module.exports = router;

