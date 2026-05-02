const express = require('express');
const {
	listShipmentsController,
	createShipmentController,
	getShipmentDetailsController,
	updateShipmentStatusController,
	clearAlarmController,
} = require('../controllers/shipment.controller');
const {
	getTelemetryLogsController,
} = require('../controllers/telemetry.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, listShipmentsController);
router.post('/', authenticate, authorizeRoles('ADMIN'), createShipmentController);
router.get('/:id', authenticate, getShipmentDetailsController);

router.patch('/:id/status', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), updateShipmentStatusController);
router.post('/:id/clear-alarm', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), clearAlarmController);

router.get('/:id/telemetry/logs', authenticate, getTelemetryLogsController);

module.exports = router;
