const express = require('express');
const telemetryRouter = require('./telemetry.route');
const authRouter = require('./auth.route');
const shipmentRouter = require('./shipment.route');

const router = express.Router();

router.use('/telemetry', telemetryRouter);
router.use('/auth', authRouter);
router.use('/shipments', shipmentRouter);

module.exports = router;

