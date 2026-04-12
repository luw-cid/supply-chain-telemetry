const express = require('express');
const telemetryRouter = require('./telemetry.route');
const authRouter     = require('./auth.route');
const shipmentRouter = require('./shipment.route');
const custodyRouter  = require('./custody.route');
const alarmsRouter   = require('./alarms.route');
const auditRouter    = require('./audit.route');
const referenceRouter = require('./reference.route');

const router = express.Router();

router.use('/api', telemetryRouter);
router.use('/api/auth', authRouter);
router.use('/api/shipments', shipmentRouter);
router.use('/api/reference', referenceRouter);
// Nhóm API Chuỗi Sở Hữu (Chain of Custody) — 3.1 & 3.2
router.use('/api/v1/shipments', custodyRouter);
router.use('/api/v1/alarms', alarmsRouter);
router.use('/api/v1/audit', auditRouter);

module.exports = router;

