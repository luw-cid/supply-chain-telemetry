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

const sagaRepository              = require('../repositories/saga.repository');
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
        idempotency_key,
    } = telemetryPoint;

    // ── 1. Validate input ────────────────────────────────────────────────────
    if (!shipment_id || !device_id || !location?.lng || !location?.lat || typeof temp !== 'number') {
        throw AppError.badRequest('Missing required telemetry fields');
    }
    if (typeof shipment_id !== 'string' || shipment_id.length > 64) {
        throw AppError.badRequest('shipment_id must be a string (max 64 chars)');
    }
    if (typeof device_id !== 'string' || device_id.length > 64) {
        throw AppError.badRequest('device_id must be a string (max 64 chars)');
    }
    if (typeof location.lng !== 'number' || typeof location.lat !== 'number') {
        throw AppError.badRequest('location.lng and location.lat must be numbers');
    }
    if (humidity != null && (typeof humidity !== 'number' || humidity < 0 || humidity > 100)) {
        throw AppError.badRequest('humidity must be a number between 0 and 100');
    }

    // ── 1b. Idempotency check ────────────────────────────────────────────────
    if (idempotency_key) {
        if (typeof idempotency_key !== 'string' || idempotency_key.length > 128) {
            throw AppError.badRequest('idempotency_key must be a string (max 128 chars)');
        }
        const existing = await sagaRepository.findByIdempotencyKey(idempotency_key);
        if (existing) {
            return {
                shipment_id,
                mongo_point_id: existing._id,
                temp,
                tempMax: null,
                violation: false,
                duplicate: true,
            };
        }
    }

    // ── 2. Ghi telemetry vào MongoDB ─────────────────────────────────────────
    const point = await sagaRepository.insertTelemetryPoint({
        shipmentId: shipment_id,
        deviceId: device_id,
        timestamp,
        location,
        temp,
        humidity,
        idempotencyKey: idempotency_key,
    });

    // ── 3. Lấy TempMax + thông tin shipment từ MySQL ─────────────────────────
    const row = await sagaRepository.getTraceRouteContext(shipment_id);
    const tempMax = row?.TempMax;

    if (tempMax == null) {
        throw AppError.notFound(`TempMax not found for shipment ${shipment_id}`);
    }

    // ── 3b. Out-of-order check: chỉ xử lý nếu điểm mới hơn điểm gần nhất ────
    const incomingTime = timestamp ? new Date(timestamp) : new Date();
    const lastTime = row?.LastTelemetryAtUTC ? new Date(row.LastTelemetryAtUTC) : null;
    if (lastTime && incomingTime < lastTime) {
        return {
            shipment_id,
            mongo_point_id: point._id,
            temp,
            tempMax,
            violation: false,
            stale: true,
        };
    }

    // ── 4. Kiểm tra vi phạm & thực thi Outbox Pattern ───────────────────────
    let violation = false;

    if (temp > tempMax) {
        violation = true;

        const { shipper_id, consignee_id } = await _safeGetShipmentParties(shipment_id);
        const [shipperContact, consigneeContact] = await Promise.all([
            getPartyContact(shipper_id),
            getPartyContact(consignee_id),
        ]);

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

        try {
            await sagaRepository.markViolationAndEnqueueAlarm({
                shipmentId: shipment_id,
                alarmReason: outboxPayload.alarm_reason,
                outboxPayload,
            });

            console.log(
                `[SagaOrchestrator] ✅ Shipment ${shipment_id} marked VIOLATION. ` +
                `Temp: ${temp}°C / Max: ${tempMax}°C`
            );

        } catch (err) {
            console.error(`[SagaOrchestrator] ❌ Transaction rolled back for shipment ${shipment_id}:`, err.message);
            throw err;
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
async function _safeGetShipmentParties(shipmentId) {
    try {
        return await sagaRepository.getShipmentParties(shipmentId);
    } catch (err) {
        console.error(`[SagaOrchestrator] Failed to get parties for shipment ${shipmentId}:`, err.message);
        return { shipper_id: null, consignee_id: null };
    }
}

module.exports = { ingestTelemetry };