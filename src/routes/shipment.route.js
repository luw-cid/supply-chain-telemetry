const express = require('express');
const {
	listShipmentsController,
	createShipmentController,
	getShipmentDetailsController,
} = require('../controllers/shipment.controller');
const {
	getTelemetryLogsController,
} = require('../controllers/telemetry.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, listShipmentsController);
router.post('/', authenticate, authorizeRoles('ADMIN'), createShipmentController);
router.get('/:id', authenticate, getShipmentDetailsController);

// GET /api/v1/shipments/:id/telemetry/logs
router.get('/:id/telemetry/logs', authenticate, getTelemetryLogsController);

module.exports = router;
