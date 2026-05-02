const telemetryRepository = require('../repositories/telemetry.repository');
const AppError = require('../utils/app-error');
const pool = require('../configs/sql.config');

async function getTelemetryLogs(shipmentId, queryParams = {}) {
	if (!shipmentId || typeof shipmentId !== 'string' || shipmentId.trim() === '') {
		throw AppError.badRequest('ShipmentID is required');
	}

	const [rows] = await pool.execute(
		'SELECT ShipmentID, CargoProfileID FROM Shipments WHERE ShipmentID = ?',
		[shipmentId]
	);

	if (rows.length === 0) {
		throw AppError.notFound(`Shipment '${shipmentId}' not found`);
	}

	const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 200);
	const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
	const skip = (page - 1) * limit;
	const sort = queryParams.sort === 'asc' ? 'asc' : 'desc';

	let startDate = null;
	let endDate = null;

	if (queryParams.startDate) {
		startDate = new Date(queryParams.startDate);
		if (isNaN(startDate.getTime())) {
			throw AppError.badRequest('Invalid startDate format. Use ISO 8601 (e.g., 2024-01-15T00:00:00Z)');
		}
	}

	if (queryParams.endDate) {
		endDate = new Date(queryParams.endDate);
		if (isNaN(endDate.getTime())) {
			throw AppError.badRequest('Invalid endDate format. Use ISO 8601 (e.g., 2024-01-15T23:59:59Z)');
		}
	}

	if (startDate && endDate && startDate > endDate) {
		throw AppError.badRequest('startDate must be before endDate');
	}

	const { logs, total } = await telemetryRepository.getTelemetryLogs(shipmentId, {
		startDate,
		endDate,
		limit,
		skip,
		sort,
	});

	const totalPages = Math.ceil(total / limit);

	return {
		success: true,
		data: {
			shipment_id: shipmentId,
			logs: logs.map((log) => ({
				timestamp: log.t,
				device_id: log.meta?.device_id || null,
				location: log.location || null,
				temp: log.temp,
				humidity: log.humidity ?? null,
			})),
		},
		pagination: {
			total,
			page,
			limit,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	};
}

async function exportTelemetryCsv(shipmentId, { startDate, endDate } = {}) {
	if (!shipmentId) {
		throw AppError.badRequest('ShipmentID is required');
	}

	const logs = await telemetryRepository.getAllTelemetryLogs(shipmentId, {
		startDate: startDate ? new Date(startDate) : null,
		endDate: endDate ? new Date(endDate) : null,
	});

	const header = 'timestamp,device_id,latitude,longitude,temp,humidity\n';
	const rows = logs.map((log) => {
		const lat = log.location?.coordinates?.[1] ?? log.location?.lat ?? '';
		const lng = log.location?.coordinates?.[0] ?? log.location?.lng ?? '';
		return `${log.t},${log.meta?.device_id || ''},${lat},${lng},${log.temp},${log.humidity ?? ''}`;
	}).join('\n');

	return header + rows;
}

async function aggregateTelemetry(shipmentId, { interval = 'hour', startDate, endDate } = {}) {
	if (!shipmentId) {
		throw AppError.badRequest('ShipmentID is required');
	}

	const validIntervals = ['minute', 'hour', 'day', 'week', 'month'];
	const aggInterval = validIntervals.includes(interval) ? interval : 'hour';

	return telemetryRepository.aggregateTelemetry(shipmentId, {
		interval: aggInterval,
		startDate: startDate ? new Date(startDate) : null,
		endDate: endDate ? new Date(endDate) : null,
	});
}

module.exports = {
	getTelemetryLogs,
	exportTelemetryCsv,
	aggregateTelemetry,
};
