const express = require('express');
const telemetryRouter = require('./telemetry.route');
const authRouter = require('./auth.route');
const shipmentRouter = require('./shipment.route');

const router = express.Router();

router.use('/api', telemetryRouter);
router.use('/api/auth', authRouter);
router.use('/api/shipments', shipmentRouter);

module.exports = router;

