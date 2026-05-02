const express = require('express');
const { listAlarmsController, updateAlarmController } = require('../controllers/alarms.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, listAlarmsController);
router.patch('/:id', authenticate, updateAlarmController);

module.exports = router;
