const express = require('express');
const { listAuditLogsController } = require('../controllers/audit.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/logs', authenticate, listAuditLogsController);

module.exports = router;
