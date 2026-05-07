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
  const { status, resolutionNote } = body || {};
  if (!status || !['ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'].includes(status)) {
    throw AppError.badRequest('status must be ACKNOWLEDGED, RESOLVED, or FALSE_ALARM');
  }
  return alarmsRepository.updateAlarmEvent({
    alarmId,
    status,
    userId: user?.sub || 'unknown',
    resolutionNote: resolutionNote || null,
  });
}

async function createAlarm(body) {
  const { shipmentId, alarmType, severity, alarmReason, source } = body || {};
  if (!shipmentId) throw AppError.badRequest('shipmentId is required');
  return alarmsRepository.createAlarmEvent({
    shipmentId,
    alarmType: alarmType || 'MANUAL',
    severity: severity || 'MEDIUM',
    alarmReason: alarmReason || 'Manual test alert',
    source: source || 'INTEGRATION',
  });
}

module.exports = {
  listAlarms,
  updateAlarm,
  createAlarm,
};
