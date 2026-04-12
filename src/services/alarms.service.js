const alarmsRepository = require('../repositories/alarms.repository');

async function listAlarms(query = {}) {
  return alarmsRepository.listAlarmEvents({
    status: query.status,
    fromDate: query.fromDate,
    toDate: query.toDate,
    page: query.page,
    limit: query.limit,
  });
}

module.exports = {
  listAlarms,
};
