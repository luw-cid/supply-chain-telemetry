const express = require('express');
const { listAlarmsController } = require('../controllers/alarms.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, listAlarmsController);

module.exports = router;
