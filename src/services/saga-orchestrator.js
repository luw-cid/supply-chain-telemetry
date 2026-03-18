'use strict';

// ============================================================================
// SAGA ORCHESTRATOR (Task 8 + Task 10 - Outbox Pattern)
// ============================================================================
// Luồng xử lý:
//   1. Validate input
//   2. Ghi telemetry vào MongoDB (time-series collection)
//   3. Lấy TempMax từ MySQL qua SP_TraceRouteContext
//   4. Nếu vi phạm nhiệt độ:
//      a. BEGIN TRANSACTION (MySQL)
//      b. UPDATE Shipments SET LastTelemetryStatus = 'VIOLATION'
//         → TRG_CHECK_VIOLATION tự set Status = 'ALARM'
//      c. INSERT INTO outbox_events  ← (Task 10) CÙNG TRANSACTION
//      d. COMMIT
//   5. Outbox Processor (chạy ngầm) sẽ đọc event và gửi notification
// ============================================================================

const TelemetryPoints             = require('../models/mongodb/telemetry_points');
const { pool }                    = require('../configs/sql.config');
const { getPartyContact }         = require('./notification.service');
const AppError                    = require('../utils/app-error');

// ============================================================================
// PUBLIC: INGEST TELEMETRY
// ============================================================================

/**
 * Nhận dữ liệu telemetry từ thiết bị IoT và xử lý toàn bộ luồng nghiệp vụ.
 *
 * @param {object} telemetryPoint
 * @param {string}  telemetryPoint.shipment_id  - ID lô hàng
 * @param {string}  telemetryPoint.device_id    - ID thiết bị IoT
 * @param {string}  [telemetryPoint.timestamp]  - ISO timestamp (optional, default: now)
 * @param {{lng: number, lat: number}} telemetryPoint.location
 * @param {number}  telemetryPoint.temp         - Nhiệt độ (°C)
 * @param {number}  [telemetryPoint.humidity]   - Độ ẩm (%)
 *
 * @returns {Promise<object>} Kết quả xử lý
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

    // ── 1. Validate input ────────────────────────────────────────────────────
    if (!shipment_id || !device_id || !location?.lng || !location?.lat || typeof temp !== 'number') {
        throw AppError.badRequest('Missing required telemetry fields');
    }

    // ── 2. Ghi telemetry vào MongoDB ─────────────────────────────────────────
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

    // ── 3. Lấy TempMax + thông tin shipment từ MySQL ─────────────────────────
    const [spResult] = await pool.query('CALL SP_TraceRouteContext(?)', [shipment_id]);

    const row    = Array.isArray(spResult) ? (spResult[0]?.[0] ?? spResult[0]) : undefined;
    const tempMax = row?.TempMax;

    if (tempMax == null) {
        throw AppError.notFound(`TempMax not found for shipment ${shipment_id}`);
    }

    // ── 4. Kiểm tra vi phạm & thực thi Outbox Pattern ───────────────────────
    let violation = false;

    if (temp > tempMax) {
        violation = true;

        // Lấy thông tin liên hệ của shipper và consignee để nhúng vào payload.
        // Làm TRƯỚC transaction để tránh giữ lock lâu trong transaction.
        const { shipper_id, consignee_id } = await _getShipmentParties(shipment_id);
        const [shipperContact, consigneeContact] = await Promise.all([
            getPartyContact(shipper_id),
            getPartyContact(consignee_id),
        ]);

        // Payload đầy đủ cho event ALARM_TRIGGERED
        const outboxPayload = {
            shipment_id,
            device_id,
            temp,
            temp_max:        tempMax,
            location,
            alarm_at:        new Date().toISOString(),
            alarm_reason:    `Nhiệt độ ${temp}°C vượt ngưỡng ${tempMax}°C (Telemetry từ ${device_id})`,
            shipper_id,
            shipper_name:    shipperContact.name,
            shipper_email:   shipperContact.email,
            consignee_id,
            consignee_name:  consigneeContact.name,
            consignee_email: consigneeContact.email,
        };

        // ── ATOMIC TRANSACTION: cập nhật DB + ghi outbox cùng lúc ────────────
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // a) Cập nhật trạng thái vi phạm trên Shipments
            //    → TRG_CHECK_VIOLATION sẽ tự set Status = 'ALARM' và AlarmAtUTC
            await connection.query(
                `UPDATE Shipments
                 SET LastTelemetryStatus = 'VIOLATION',
                     LastTelemetryAtUTC  = CURRENT_TIMESTAMP(6),
                     AlarmReason         = COALESCE(AlarmReason, ?)
                 WHERE ShipmentID = ?`,
                [outboxPayload.alarm_reason, shipment_id]
            );

            // b) Ghi event vào outbox_events trong CÙNG transaction
            //    → Đảm bảo: nếu UPDATE thành công thì notification CHẮC CHẮN sẽ được gửi
            await connection.query(
                `INSERT INTO outbox_events (event_type, payload)
                 VALUES ('ALARM_TRIGGERED', ?)`,
                [JSON.stringify(outboxPayload)]
            );

            await connection.commit();

            console.log(
                `[SagaOrchestrator] ✅ Shipment ${shipment_id} marked VIOLATION. ` +
                `Outbox event created. Temp: ${temp}°C / Max: ${tempMax}°C`
            );

        } catch (err) {
            await connection.rollback();
            console.error(`[SagaOrchestrator] ❌ Transaction rolled back for shipment ${shipment_id}:`, err.message);
            throw err;
        } finally {
            connection.release();
        }
    }

    // ── 5. Trả kết quả ───────────────────────────────────────────────────────
    return {
        shipment_id,
        mongo_point_id: point._id,
        temp,
        tempMax,
        violation,
    };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Lấy ShipperPartyID và ConsigneePartyID của một Shipment từ MySQL.
 *
 * @param {string} shipmentId
 * @returns {Promise<{shipper_id: string|null, consignee_id: string|null}>}
 */
async function _getShipmentParties(shipmentId) {
    try {
        const [rows] = await pool.query(
            `SELECT ShipperPartyID, ConsigneePartyID
             FROM   Shipments
             WHERE  ShipmentID = ?
             LIMIT  1`,
            [shipmentId]
        );
        if (rows.length === 0) return { shipper_id: null, consignee_id: null };
        return {
            shipper_id:   rows[0].ShipperPartyID   || null,
            consignee_id: rows[0].ConsigneePartyID || null,
        };
    } catch (err) {
        console.error(`[SagaOrchestrator] Failed to get parties for shipment ${shipmentId}:`, err.message);
        return { shipper_id: null, consignee_id: null };
    }
}

module.exports = { ingestTelemetry };