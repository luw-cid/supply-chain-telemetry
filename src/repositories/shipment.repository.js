const { pool } = require('../configs/sql.config');
const ShipmentRoutes = require('../models/mongodb/shipment_routes');

async function findShipmentById(shipmentId) {
  const [rows] = await pool.query(
    'SELECT ShipmentID FROM Shipments WHERE ShipmentID = ? LIMIT 1',
    [shipmentId]
  );

  return rows[0] || null;
}

async function findCargoProfileById(cargoProfileId) {
  const [rows] = await pool.query(
    'SELECT CargoProfileID FROM CargoProfiles WHERE CargoProfileID = ? LIMIT 1',
    [cargoProfileId]
  );

  return rows[0] || null;
}

async function findPartyById(partyId) {
  const [rows] = await pool.query(
    'SELECT PartyID FROM Parties WHERE PartyID = ? LIMIT 1',
    [partyId]
  );

  return rows[0] || null;
}

async function findPortByCode(portCode) {
  const [rows] = await pool.query(
    'SELECT PortCode FROM Ports WHERE PortCode = ? LIMIT 1',
    [portCode]
  );

  return rows[0] || null;
}

async function insertShipment({
  shipmentId,
  cargoProfileId,
  weightKg,
  shipperPartyId,
  consigneePartyId,
  originPortCode,
  destinationPortCode,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO Shipments (
        ShipmentID,
        CargoProfileID,
        WeightKg,
        ShipperPartyID,
        ConsigneePartyID,
        OriginPortCode,
        DestinationPortCode,
        Status,
        CurrentPortCode,
        CurrentLocation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NORMAL', ?, ?)`,
      [
        shipmentId,
        cargoProfileId,
        weightKg,
        shipperPartyId,
        consigneePartyId,
        originPortCode,
        destinationPortCode,
        originPortCode,
        originPortCode,
      ]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createShipmentRoute({ shipmentId, originPortCode, destinationPortCode }) {
  await ShipmentRoutes.create({
    shipment_id: shipmentId,
    origin_port: originPortCode,
    destination_port: destinationPortCode,
    planned_route: [
      { port_code: originPortCode, sequence: 1 },
      { port_code: destinationPortCode, sequence: 2 },
    ],
    route_status: 'ON_SCHEDULE',
  });
}

async function findShipmentDetailsById(shipmentId) {
  const [rows] = await pool.query(
    `SELECT
      s.ShipmentID,
      s.CargoProfileID,
      s.WeightKg,
      s.ShipperPartyID,
      s.ConsigneePartyID,
      s.OriginPortCode,
      s.DestinationPortCode,
      s.Status,
      s.CurrentLocation,
      s.CurrentPortCode,
      s.LastTelemetryAtUTC,
      s.LastTelemetryStatus,
      s.AlarmAtUTC,
      s.AlarmReason,
      s.CreatedAtUTC,
      s.UpdatedAtUTC,
      cp.TempMin,
      cp.TempMax,
      cp.HumidityMin,
      cp.HumidityMax,
      cp.MaxTransitHours
     FROM Shipments s
     JOIN CargoProfiles cp ON cp.CargoProfileID = s.CargoProfileID
     WHERE s.ShipmentID = ?
     LIMIT 1`,
    [shipmentId]
  );

  return rows[0] || null;
}

async function findShipmentRouteById(shipmentId) {
  return ShipmentRoutes.findOne({ shipment_id: shipmentId })
    .select({
      _id: 0,
      shipment_id: 1,
      current_position: 1,
      route_status: 1,
      last_telemetry_at: 1,
      planned_route: 1,
    })
    .lean();
}

module.exports = {
  findShipmentById,
  findCargoProfileById,
  findPartyById,
  findPortByCode,
  insertShipment,
  createShipmentRoute,
  findShipmentDetailsById,
  findShipmentRouteById,
};
