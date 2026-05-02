const alarmsService = require('../services/alarms.service');

async function listAlarmsController(req, res, next) {
  try {
    const result = await alarmsService.listAlarms(req.query);
    return res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function acknowledgeAlarmController(req, res, next) {
  try {
    const result = await alarmsService.acknowledgeAlarm(
      req.params.id,
      req.user.sub
    );
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function assignAlarmController(req, res, next) {
  try {
    const { assignedTo } = req.body;
    const result = await alarmsService.assignAlarm(
      req.params.id,
      assignedTo,
      req.user.sub
    );
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function resolveAlarmController(req, res, next) {
  try {
    const { resolution, newStatus } = req.body;
    const result = await alarmsService.resolveAlarm(
      req.params.id,
      req.user.sub,
      resolution || 'Resolved manually',
      newStatus || 'RESOLVED'
    );
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function getAlarmStatsController(req, res, next) {
  try {
    const result = await alarmsService.getAlarmStats();
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listAlarmsController,
  acknowledgeAlarmController,
  assignAlarmController,
  resolveAlarmController,
  getAlarmStatsController,
};
