const express = require('express');
const {
	createShipmentController,
	getShipmentDetailsController,
} = require('../controllers/shipment.controller');
const {
	getTelemetryLogsController,
} = require('../controllers/telemetry.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', createShipmentController);
router.get('/:id', getShipmentDetailsController);

// GET /api/v1/shipments/:id/telemetry/logs
router.get('/:id/telemetry/logs', authenticate, getTelemetryLogsController);

module.exports = router;
