const express = require('express');
const { ingestTelemetryController } = require('../controllers/telemetry.controller');

const router = express.Router();

// POST /api/v1/telemetry/ingest
router.post('/ingest', ingestTelemetryController);

module.exports = router;

