const express = require('express');
const { ingestTelemetryController } = require('../controllers/telemetry.controller');

const router = express.Router();

// POST /api/telemetry
router.post('/telemetry', ingestTelemetryController);

module.exports = router;

