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

async function acknowledgeAlarm(alarmEventId, userId) {
  if (!alarmEventId) {
    throw AppError.badRequest('AlarmEventID is required');
  }
  const result = await alarmsRepository.updateAlarmStatus(alarmEventId, {
    status: 'ACKNOWLEDGED',
    acknowledgedBy: userId,
    acknowledgedAt: new Date(),
  });
  if (result.affectedRows === 0) {
    throw AppError.notFound(`Alarm ${alarmEventId} not found`);
  }
  return { AlarmEventID: alarmEventId, Status: 'ACKNOWLEDGED', AcknowledgedBy: userId };
}

async function assignAlarm(alarmEventId, assignedTo, assignedBy) {
  if (!alarmEventId) {
    throw AppError.badRequest('AlarmEventID is required');
  }
  if (!assignedTo) {
    throw AppError.badRequest('assignedTo is required');
  }
  const result = await alarmsRepository.updateAlarmStatus(alarmEventId, {
    assignedTo,
    assignedAt: new Date(),
  });
  if (result.affectedRows === 0) {
    throw AppError.notFound(`Alarm ${alarmEventId} not found`);
  }
  return { AlarmEventID: alarmEventId, AssignedTo: assignedTo, AssignedBy: assignedBy };
}

async function resolveAlarm(alarmEventId, resolvedBy, resolution, newStatus) {
  if (!alarmEventId) {
    throw AppError.badRequest('AlarmEventID is required');
  }
  const validStatuses = ['RESOLVED', 'FALSE_ALARM'];
  const status = validStatuses.includes(newStatus) ? newStatus : 'RESOLVED';

  const result = await alarmsRepository.resolveAlarm(alarmEventId, {
    status,
    resolvedBy,
    resolvedAt: new Date(),
    resolution,
  });
  if (result.affectedRows === 0) {
    throw AppError.notFound(`Alarm ${alarmEventId} not found`);
  }
  return { AlarmEventID: alarmEventId, Status: status, ResolvedBy: resolvedBy, Resolution: resolution };
}

async function getAlarmStats() {
  return alarmsRepository.getAlarmStats();
}

module.exports = {
  listAlarms,
  acknowledgeAlarm,
  assignAlarm,
  resolveAlarm,
  getAlarmStats,
};
