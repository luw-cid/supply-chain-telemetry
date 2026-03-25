const TelemetryPoints = require('../models/mongodb/telemetry_points');

// ============================================================================
// TELEMETRY REPOSITORY
// ============================================================================
// Truy xuất dữ liệu telemetry từ MongoDB collection telemetry_points
// ============================================================================

/**
 * Lấy danh sách telemetry logs cho một shipment
 * @param {string} shipmentId - ID của shipment
 * @param {Object} options - Tuỳ chọn truy vấn
 * @param {Date}   [options.startDate] - Lọc từ ngày
 * @param {Date}   [options.endDate]   - Lọc đến ngày
 * @param {number} [options.limit=50]  - Số bản ghi tối đa
 * @param {number} [options.skip=0]    - Bỏ qua bao nhiêu bản ghi (pagination)
 * @param {string} [options.sort='desc'] - Sắp xếp theo thời gian: 'asc' | 'desc'
 * @returns {Promise<{logs: Array, total: number}>}
 */
async function getTelemetryLogs(shipmentId, options = {}) {
	const {
		startDate,
		endDate,
		limit = 50,
		skip = 0,
		sort = 'desc',
	} = options;

	// Build filter
	const filter = { 'meta.shipment_id': shipmentId };

	if (startDate || endDate) {
		filter.t = {};
		if (startDate) filter.t.$gte = new Date(startDate);
		if (endDate) filter.t.$lte = new Date(endDate);
	}

	// Sort direction
	const sortDir = sort === 'asc' ? 1 : -1;

	// Count total matching documents (for pagination metadata)
	const total = await TelemetryPoints.countDocuments(filter);

	// Query with projection, sort, skip, limit
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

module.exports = {
	getTelemetryLogs,
};
