const express = require('express');
const { listAlarmsController, updateAlarmController, createAlarmController } = require('../controllers/alarms.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, listAlarmsController);
router.post('/', authenticate, createAlarmController);
router.patch('/:id', authenticate, updateAlarmController);

module.exports = router;
