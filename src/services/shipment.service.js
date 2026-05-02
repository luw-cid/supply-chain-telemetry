const shipmentRepository = require('../repositories/shipment.repository');
const auditRepository = require('../repositories/audit.repository');
const AppError = require('../utils/app-error');

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
    throw AppError.badRequest(
      'CargoProfileID, WeightKg, ShipperPartyID, ConsigneePartyID, OriginPortCode, DestinationPortCode are required'
    );
  }

  const normalizedWeight = Number(WeightKg);
  if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) {
    throw AppError.badRequest('WeightKg must be a positive number');
  }

  const shipmentId = ShipmentID ? String(ShipmentID).trim() : buildShipmentId();

  const existingShipment = await shipmentRepository.findShipmentById(shipmentId);
  if (existingShipment) {
    throw AppError.badRequest(`ShipmentID ${shipmentId} already exists`);
  }

  const cargo = await shipmentRepository.findCargoProfileById(CargoProfileID);
  if (!cargo) {
    throw AppError.notFound(`CargoProfileID ${CargoProfileID} not found`);
  }

  const shipper = await shipmentRepository.findPartyById(ShipperPartyID);
  if (!shipper) {
    throw AppError.notFound(`ShipperPartyID ${ShipperPartyID} not found`);
  }

  const consignee = await shipmentRepository.findPartyById(ConsigneePartyID);
  if (!consignee) {
    throw AppError.notFound(`ConsigneePartyID ${ConsigneePartyID} not found`);
  }

  const origin = await shipmentRepository.findPortByCode(OriginPortCode);
  if (!origin) {
    throw AppError.notFound(`OriginPortCode ${OriginPortCode} not found`);
  }

  const destination = await shipmentRepository.findPortByCode(DestinationPortCode);
  if (!destination) {
    throw AppError.notFound(`DestinationPortCode ${DestinationPortCode} not found`);
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

async function getShipmentDetails(shipmentId, access = {}) {
  if (!shipmentId) {
    throw AppError.badRequest('Shipment id is required');
  }

  const shipment = await shipmentRepository.findShipmentDetailsById(shipmentId);
  if (!shipment) {
    throw AppError.notFound(`Shipment ${shipmentId} not found`);
  }

  const { role, partyId } = access;
  if (role === 'OWNER') {
    if (!partyId) {
      throw AppError.forbidden('Tài khoản OWNER cần được gán PartyID để xem lô hàng');
    }
    if (shipment.ShipperPartyID !== partyId && shipment.ConsigneePartyID !== partyId) {
      throw AppError.forbidden('Bạn không có quyền xem lô hàng này');
    }
  }

  const routeDoc = await shipmentRepository.findShipmentRouteById(shipmentId);

  return {
    shipment,
    route: routeDoc || null,
  };
}

async function listShipments(query = {}, access = {}) {
  const { role, partyId } = access;
  let partyScopeId;
  if (role === 'OWNER') {
    if (!partyId) {
      const page = Math.max(parseInt(String(query.page), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(query.limit), 10) || 20, 1), 100);
      return { items: [], total: 0, page, limit };
    }
    partyScopeId = partyId;
  }

  return shipmentRepository.listShipmentsWithDisplay({
    status: query.status,
    search: query.search,
    page: query.page,
    limit: query.limit,
    partyScopeId,
  });
}

async function updateShipmentStatus(shipmentId, newStatus, changedBy) {
  if (!shipmentId) {
    throw AppError.badRequest('ShipmentID is required');
  }

  const validStatuses = ['NORMAL', 'IN_TRANSIT', 'COMPLETED'];
  const status = String(newStatus).toUpperCase();
  if (!validStatuses.includes(status)) {
    throw AppError.badRequest(`Invalid status. Allowed: ${validStatuses.join(', ')}`);
  }

  const shipment = await shipmentRepository.findShipmentDetailsById(shipmentId);
  if (!shipment) {
    throw AppError.notFound(`Shipment ${shipmentId} not found`);
  }

  if (shipment.Status === 'ALARM' && status !== 'NORMAL') {
    throw AppError.conflict(`Cannot change status from ALARM to ${status}. Resolve alarm first.`);
  }

  const oldStatus = shipment.Status;

  await shipmentRepository.updateShipmentStatus(shipmentId, status);

  await auditRepository.insertAuditLog({
    tableName: 'Shipments',
    operation: 'UPDATE',
    recordId: shipmentId,
    oldValue: { Status: oldStatus },
    newValue: { Status: status },
    changedBy,
  });

  return { ShipmentID: shipmentId, OldStatus: oldStatus, NewStatus: status };
}

async function clearAlarm(shipmentId, changedBy) {
  if (!shipmentId) {
    throw AppError.badRequest('ShipmentID is required');
  }

  const shipment = await shipmentRepository.findShipmentDetailsById(shipmentId);
  if (!shipment) {
    throw AppError.notFound(`Shipment ${shipmentId} not found`);
  }

  if (shipment.Status !== 'ALARM') {
    throw AppError.conflict(`Shipment ${shipmentId} is not in ALARM status`);
  }

  await shipmentRepository.clearShipmentAlarm(shipmentId);

  await auditRepository.insertAuditLog({
    tableName: 'Shipments',
    operation: 'UPDATE',
    recordId: shipmentId,
    oldValue: {
      Status: 'ALARM',
      AlarmReason: shipment.AlarmReason,
      LastTelemetryStatus: 'VIOLATION',
    },
    newValue: {
      Status: 'NORMAL',
      AlarmReason: null,
      LastTelemetryStatus: 'OK',
    },
    changedBy,
  });

  return {
    ShipmentID: shipmentId,
    Status: 'NORMAL',
    AlarmAtUTC: null,
    AlarmReason: null,
    LastTelemetryStatus: 'OK',
  };
}

module.exports = {
  createShipment,
  getShipmentDetails,
  listShipments,
  updateShipmentStatus,
  clearAlarm,
};
