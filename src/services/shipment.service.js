const shipmentRepository = require('../repositories/shipment.repository');

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function buildShipmentId() {
  return `SHP-${Date.now()}`;
}

async function createShipment(payload) {
  const {
    CargoProfileID,
    WeightKg,
    ShipperPartyID,
    ConsigneePartyID,
    OriginPortCode,
    DestinationPortCode,
    ShipmentID,
  } = payload;

  if (
    !CargoProfileID ||
    WeightKg == null ||
    !ShipperPartyID ||
    !ConsigneePartyID ||
    !OriginPortCode ||
    !DestinationPortCode
  ) {
    throw badRequest(
      'CargoProfileID, WeightKg, ShipperPartyID, ConsigneePartyID, OriginPortCode, DestinationPortCode are required'
    );
  }

  const normalizedWeight = Number(WeightKg);
  if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) {
    throw badRequest('WeightKg must be a positive number');
  }

  const shipmentId = ShipmentID ? String(ShipmentID).trim() : buildShipmentId();

  const existingShipment = await shipmentRepository.findShipmentById(shipmentId);
  if (existingShipment) {
    throw badRequest(`ShipmentID ${shipmentId} already exists`);
  }

  const cargo = await shipmentRepository.findCargoProfileById(CargoProfileID);
  if (!cargo) {
    throw notFound(`CargoProfileID ${CargoProfileID} not found`);
  }

  const shipper = await shipmentRepository.findPartyById(ShipperPartyID);
  if (!shipper) {
    throw notFound(`ShipperPartyID ${ShipperPartyID} not found`);
  }

  const consignee = await shipmentRepository.findPartyById(ConsigneePartyID);
  if (!consignee) {
    throw notFound(`ConsigneePartyID ${ConsigneePartyID} not found`);
  }

  const origin = await shipmentRepository.findPortByCode(OriginPortCode);
  if (!origin) {
    throw notFound(`OriginPortCode ${OriginPortCode} not found`);
  }

  const destination = await shipmentRepository.findPortByCode(DestinationPortCode);
  if (!destination) {
    throw notFound(`DestinationPortCode ${DestinationPortCode} not found`);
  }

  await shipmentRepository.insertShipment({
    shipmentId,
    cargoProfileId: CargoProfileID,
    weightKg: normalizedWeight,
    shipperPartyId: ShipperPartyID,
    consigneePartyId: ConsigneePartyID,
    originPortCode: OriginPortCode,
    destinationPortCode: DestinationPortCode,
  });

  await shipmentRepository.createShipmentRoute({
    shipmentId,
    originPortCode: OriginPortCode,
    destinationPortCode: DestinationPortCode,
  });

  return {
    ShipmentID: shipmentId,
    CargoProfileID,
    WeightKg: normalizedWeight,
    ShipperPartyID,
    ConsigneePartyID,
    OriginPortCode,
    DestinationPortCode,
    Status: 'NORMAL',
    route_sync: 'CREATED',
  };
}

async function getShipmentDetails(shipmentId) {
  if (!shipmentId) {
    throw badRequest('Shipment id is required');
  }

  const shipment = await shipmentRepository.findShipmentDetailsById(shipmentId);
  if (!shipment) {
    throw notFound(`Shipment ${shipmentId} not found`);
  }

  const routeDoc = await shipmentRepository.findShipmentRouteById(shipmentId);

  return {
    shipment,
    route: routeDoc || null,
  };
}

module.exports = {
  createShipment,
  getShipmentDetails,
};
