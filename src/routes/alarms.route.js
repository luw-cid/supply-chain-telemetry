const express = require('express');
const {
  listAlarmsController,
  acknowledgeAlarmController,
  assignAlarmController,
  resolveAlarmController,
  getAlarmStatsController,
} = require('../controllers/alarms.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, listAlarmsController);
router.get('/stats', authenticate, getAlarmStatsController);
router.patch('/:id/ack', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), acknowledgeAlarmController);
router.patch('/:id/assign', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), assignAlarmController);
router.patch('/:id/resolve', authenticate, authorizeRoles('ADMIN', 'LOGISTICS'), resolveAlarmController);

module.exports = router;
