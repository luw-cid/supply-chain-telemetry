const express = require('express');
const { 
  ingestTelemetryController,
  getTelemetryLogsController,
  traceRouteController,
  routeOptimizationController,
  exportTelemetryCsvController,
  aggregateTelemetryController,
} = require('../controllers/telemetry.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/ingest', ingestTelemetryController);

router.get('/v1/analytics/trace-route/:shipmentId', traceRouteController);
router.get('/v1/analytics/route-optimization', routeOptimizationController);

router.get('/v1/telemetry/export', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), exportTelemetryCsvController);
router.get('/v1/telemetry/aggregate', authenticate, aggregateTelemetryController);

module.exports = router;
