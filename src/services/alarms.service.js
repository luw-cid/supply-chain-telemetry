const alarmsRepository = require('../repositories/alarms.repository');
const AppError = require('../utils/app-error');

async function listAlarms(query = {}) {
  return alarmsRepository.listAlarmEvents({
    status: query.status,
    severity: query.severity,
    alarmType: query.alarmType,
    fromDate: query.fromDate,
    toDate: query.toDate,
    page: query.page,
    limit: query.limit,
  });
}

async function updateAlarm(alarmId, body, user) {
  if (!alarmId) throw AppError.badRequest('AlarmEventID is required');
  const { status } = body || {};
  if (!status || !['ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'].includes(status)) {
    throw AppError.badRequest('status must be ACKNOWLEDGED, RESOLVED, or FALSE_ALARM');
  }
  return alarmsRepository.updateAlarmEvent({
    alarmId,
    status,
    userId: user?.sub || 'unknown',
  });
}

module.exports = {
  listAlarms,
  updateAlarm,
};
