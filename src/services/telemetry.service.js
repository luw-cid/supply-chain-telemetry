const telemetryRepository = require('../repositories/telemetry.repository');
const AppError = require('../utils/app-error');
const pool = require('../configs/sql.config');

// ============================================================================
// TELEMETRY SERVICE
// ============================================================================
// Business logic cho Telemetry & IoT Monitoring
// ============================================================================

/**
 * Lấy telemetry logs của một shipment
 *
 * Logic:
 * 1. Validate shipmentId tồn tại trong MySQL
 * 2. Query MongoDB telemetry_points với filter & pagination
 * 3. Format response bao gồm temperature, humidity, location, timestamp
 *
 * @param {string} shipmentId - ID của shipment
 * @param {Object} queryParams - Query parameters từ HTTP request
 * @param {string} [queryParams.startDate] - ISO date string lọc từ ngày
 * @param {string} [queryParams.endDate]   - ISO date string lọc đến ngày
 * @param {number} [queryParams.limit]     - Số bản ghi mỗi trang (default 50, max 200)
 * @param {number} [queryParams.page]      - Số trang (1-indexed, default 1)
 * @param {string} [queryParams.sort]      - 'asc' | 'desc' (default 'desc')
 * @returns {Promise<Object>} Response object
 */
async function getTelemetryLogs(shipmentId, queryParams = {}) {
	// ========================================================================
	// STEP 1: Validate shipmentId
	// ========================================================================
	if (!shipmentId || typeof shipmentId !== 'string' || shipmentId.trim() === '') {
		throw AppError.badRequest('ShipmentID is required');
	}

	// Kiểm tra shipment tồn tại trong MySQL
	const [rows] = await pool.execute(
		'SELECT ShipmentID, CargoProfileID FROM Shipments WHERE ShipmentID = ?',
		[shipmentId]
	);

	if (rows.length === 0) {
		throw AppError.notFound(`Shipment '${shipmentId}' not found`);
	}

	// ========================================================================
	// STEP 2: Parse & validate query params
	// ========================================================================
	const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 200);
	const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
	const skip = (page - 1) * limit;
	const sort = queryParams.sort === 'asc' ? 'asc' : 'desc';

	// Validate dates nếu có
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

	// ========================================================================
	// STEP 3: Query MongoDB
	// ========================================================================
	const { logs, total } = await telemetryRepository.getTelemetryLogs(shipmentId, {
		startDate,
		endDate,
		limit,
		skip,
		sort,
	});

	// ========================================================================
	// STEP 4: Format response
	// ========================================================================
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

module.exports = {
	getTelemetryLogs,
};
