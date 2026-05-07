'use strict';

const { pool } = require('../configs/sql.config');
const TelemetryPoints = require('../models/mongodb/telemetry_points');

async function insertTelemetryPoint({ shipmentId, deviceId, timestamp, location, temp, humidity, idempotencyKey }) {
  const doc = {
    meta: { shipment_id: shipmentId, device_id: deviceId },
    t: timestamp ? new Date(timestamp) : new Date(),
    location: {
      type: 'Point',
      coordinates: [location.lng, location.lat],
    },
    temp,
    humidity,
  };
  if (idempotencyKey) doc.idempotency_key = idempotencyKey;
  return TelemetryPoints.create(doc);
}

async function findByIdempotencyKey(key) {
  return TelemetryPoints.findOne({ idempotency_key: key }).lean();
}

async function getTraceRouteContext(shipmentId) {
  const [spResult] = await pool.query('CALL SP_TraceRouteContext(?)', [shipmentId]);
  return Array.isArray(spResult) ? (spResult[0]?.[0] ?? spResult[0]) : undefined;
}

async function getShipmentParties(shipmentId) {
  const [rows] = await pool.query(
    `SELECT ShipperPartyID, ConsigneePartyID
     FROM   Shipments
     WHERE  ShipmentID = ?
     LIMIT  1`,
    [shipmentId]
  );

  if (rows.length === 0) return { shipper_id: null, consignee_id: null };
  return {
    shipper_id: rows[0].ShipperPartyID || null,
    consignee_id: rows[0].ConsigneePartyID || null,
  };
}

async function markViolationAndEnqueueAlarm({ shipmentId, alarmReason, outboxPayload }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE Shipments
       SET LastTelemetryStatus = 'VIOLATION',
           LastTelemetryAtUTC  = CURRENT_TIMESTAMP(6),
           Status              = 'ALARM',
           AlarmReason         = COALESCE(AlarmReason, ?)
       WHERE ShipmentID = ?`,
      [alarmReason, shipmentId]
    );

    await connection.query(
      `INSERT INTO AlarmEvents (AlarmEventID, ShipmentID, AlarmType, Severity, Status, AlarmReason, AlarmAtUTC, Source)
       VALUES (UUID(), ?, 'TEMP_VIOLATION', 'HIGH', 'OPEN', ?, CURRENT_TIMESTAMP(6), 'SQL_TRIGGER')`,
      [shipmentId, alarmReason]
    );

    await connection.query(
      `INSERT INTO outbox_events (event_type, payload)
       VALUES ('ALARM_TRIGGERED', ?)`,
      [JSON.stringify(outboxPayload)]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  insertTelemetryPoint,
  findByIdempotencyKey,
  getTraceRouteContext,
  getShipmentParties,
  markViolationAndEnqueueAlarm,
};
