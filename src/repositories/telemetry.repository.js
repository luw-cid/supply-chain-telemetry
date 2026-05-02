const TelemetryPoints = require('../models/mongodb/telemetry_points');

async function getTelemetryLogs(shipmentId, options = {}) {
	const {
		startDate,
		endDate,
		limit = 50,
		skip = 0,
		sort = 'desc',
	} = options;

	const filter = { 'meta.shipment_id': shipmentId };

	if (startDate || endDate) {
		filter.t = {};
		if (startDate) filter.t.$gte = new Date(startDate);
		if (endDate) filter.t.$lte = new Date(endDate);
	}

	const sortDir = sort === 'asc' ? 1 : -1;

	const total = await TelemetryPoints.countDocuments(filter);

	const logs = await TelemetryPoints.find(filter)
		.select({
			_id: 0,
			't': 1,
			'meta.shipment_id': 1,
			'meta.device_id': 1,
			'location': 1,
			'temp': 1,
			'humidity': 1,
		})
		.sort({ t: sortDir })
		.skip(skip)
		.limit(limit)
		.lean();

	return { logs, total };
}

async function getAllTelemetryLogs(shipmentId, { startDate, endDate } = {}) {
	const filter = { 'meta.shipment_id': shipmentId };

	if (startDate || endDate) {
		filter.t = {};
		if (startDate) filter.t.$gte = startDate;
		if (endDate) filter.t.$lte = endDate;
	}

	return TelemetryPoints.find(filter)
		.select({
			_id: 0,
			't': 1,
			'meta.shipment_id': 1,
			'meta.device_id': 1,
			'location': 1,
			'temp': 1,
			'humidity': 1,
		})
		.sort({ t: 1 })
		.lean();
}

async function aggregateTelemetry(shipmentId, { interval = 'hour', startDate, endDate } = {}) {
	const match = { 'meta.shipment_id': shipmentId };

	if (startDate || endDate) {
		match.t = {};
		if (startDate) match.t.$gte = startDate;
		if (endDate) match.t.$lte = endDate;
	}

	const groupId = {};
	switch (interval) {
		case 'minute':
			groupId.$dateToString = { format: '%Y-%m-%dT%H:%M:00Z', date: '$t' };
			break;
		case 'hour':
			groupId.$dateToString = { format: '%Y-%m-%dT%H:00:00Z', date: '$t' };
			break;
		case 'day':
			groupId.$dateToString = { format: '%Y-%m-%dT00:00:00Z', date: '$t' };
			break;
		case 'week':
			groupId.$isoWeek = '$t';
			break;
		case 'month':
			groupId.$dateToString = { format: '%Y-%m-01T00:00:00Z', date: '$t' };
			break;
		default:
			groupId.$dateToString = { format: '%Y-%m-%dT%H:00:00Z', date: '$t' };
	}

	const results = await TelemetryPoints.aggregate([
		{ $match: match },
		{
			$group: {
				_id: groupId,
				count: { $sum: 1 },
				avgTemp: { $avg: '$temp' },
				minTemp: { $min: '$temp' },
				maxTemp: { $max: '$temp' },
				avgHumidity: { $avg: '$humidity' },
				minHumidity: { $min: '$humidity' },
				maxHumidity: { $max: '$humidity' },
			},
		},
		{ $sort: { _id: 1 } },
	]).allowDiskUse(true);

	return results.map((r) => ({
		interval: r._id,
		count: r.count,
		avgTemp: Math.round(r.avgTemp * 100) / 100,
		minTemp: Math.round(r.minTemp * 100) / 100,
		maxTemp: Math.round(r.maxTemp * 100) / 100,
		avgHumidity: r.avgHumidity != null ? Math.round(r.avgHumidity * 100) / 100 : null,
		minHumidity: r.minHumidity != null ? Math.round(r.minHumidity * 100) / 100 : null,
		maxHumidity: r.maxHumidity != null ? Math.round(r.maxHumidity * 100) / 100 : null,
	}));
}

module.exports = {
	getTelemetryLogs,
	getAllTelemetryLogs,
	aggregateTelemetry,
};
