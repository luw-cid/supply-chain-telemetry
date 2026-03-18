const TelemetryPoints = require('../models/mongodb/telemetry_points');
const { pool } = require('../configs/sql.config');

/**
 * Saga Orchestrator cho luồng Telemetry:
 * - Nhận telemetry từ thiết bị
 * - Ghi vào MongoDB (telemetry_points)
 * - Lấy TempMax từ MySQL (SP_TraceRouteContext)
 * - Nếu vi phạm nhiệt độ: update Shipments.LastTelemetryStatus = 'VIOLATION'
 *   (trigger TRG_CHECK_VIOLATION sẽ tự chuyển Status = 'ALARM')
 */
async function ingestTelemetry(telemetryPoint) {
  const {
    shipment_id,
    device_id,
    timestamp,
    location,
    temp,
    humidity,
  } = telemetryPoint;

  // 1. Validate input
  if (!shipment_id || !device_id || !location?.lng || !location?.lat || typeof temp !== 'number') {
    const err = new Error('Missing required telemetry fields');
    err.statusCode = 400;
    throw err;
  }

  // 2. Ghi telemetry vào MongoDB (time-series collection)
  const point = await TelemetryPoints.create({
    meta: { shipment_id, device_id },
    t: timestamp ? new Date(timestamp) : new Date(),
    location: {
      type: 'Point',
      coordinates: [location.lng, location.lat],
    },
    temp,
    humidity,
  });

  // 3. Lấy TempMax từ MySQL qua stored procedure SP_TraceRouteContext
  const [spResult] = await pool.query('CALL SP_TraceRouteContext(?)', [shipment_id]);
  // Tùy cấu trúc result set, thường spResult[0] là row đầu tiên của result set 1
  const tempMax = Array.isArray(spResult)
    ? (spResult[0]?.TempMax ?? spResult[0]?.[0]?.TempMax)
    : undefined;

  if (tempMax == null) {
    const err = new Error(`TempMax not found for shipment ${shipment_id}`);
    err.statusCode = 404;
    throw err;
  }

  // 4. So sánh nhiệt độ và cập nhật SQL nếu vi phạm
  let violation = false;

  if (temp > tempMax) {
    violation = true;
    const connection = await pool.getConnection();

    try {
      await connection.query(
        `UPDATE Shipments
         SET LastTelemetryStatus = 'VIOLATION',
             LastTelemetryAtUTC = CURRENT_TIMESTAMP(6),
             AlarmReason = COALESCE(AlarmReason, 'Telemetry violation from Saga Orchestrator')
         WHERE ShipmentID = ?`,
        [shipment_id]
      );
      // TRG_CHECK_VIOLATION sẽ tự set Status = 'ALARM' và AlarmAtUTC nếu cần
    } finally {
      connection.release();
    }
  }

  return {
    shipment_id,
    mongo_point_id: point._id,
    temp,
    tempMax,
    violation,
  };
}

module.exports = { ingestTelemetry };