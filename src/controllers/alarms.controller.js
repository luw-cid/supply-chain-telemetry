const { listAlarms, updateAlarm, createAlarm } = require('../services/alarms.service');

async function listAlarmsController(req, res, next) {
  try {
    const result = await listAlarms(req.query);
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

async function updateAlarmController(req, res, next) {
  try {
    const result = await updateAlarm(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function createAlarmController(req, res, next) {
  try {
    const result = await createAlarm(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listAlarmsController,
  updateAlarmController,
  createAlarmController,
};
