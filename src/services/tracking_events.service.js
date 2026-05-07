'use strict';

const AppError = require('../utils/app-error');
const shipmentRepository = require('../repositories/shipment.repository');
const portRepository = require('../repositories/port.repository');
const trackingEventsRepository = require('../repositories/tracking_events.repository');
const { ensureShipmentAccess } = require('./shipment.service');

async function recordCustodyTransferMarker({ shipmentId, fromPartyId, toPartyId, handoverPortCode }) {
  if (!shipmentId) throw AppError.badRequest('shipmentId is required');

  // Derive marker position from Shipments.CurrentPortCode / CurrentLocation as requested.
  // Most implementations update CurrentPortCode to handover port during transfer SP.
  const shipment = await shipmentRepository.findShipmentDetailsById(String(shipmentId).trim());
  if (!shipment) throw AppError.notFound(`Shipment ${shipmentId} not found`);

  const portCode = shipment.CurrentPortCode ? String(shipment.CurrentPortCode) : null;
  const label = shipment.CurrentLocation ? String(shipment.CurrentLocation) : null;

  let coords = null;
  if (portCode) {
    const port = await portRepository.findPortByCode(portCode);
    if (port?.Longitude != null && port?.Latitude != null) {
      const lng = Number(port.Longitude);
      const lat = Number(port.Latitude);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        coords = [lng, lat];
      }
    }
  }

  await trackingEventsRepository.insertTrackingEvent({
    shipment_id: String(shipmentId).trim(),
    type: 'CUSTODY_TRANSFER',
    t: new Date(),
    ...(coords ? { location: { type: 'Point', coordinates: coords } } : {}),
    ...(portCode ? { port_code: portCode } : {}),
    ...(label ? { label } : {}),
    payload: {
      fromPartyId: fromPartyId ?? null,
      toPartyId: toPartyId ?? null,
      handoverPortCode: handoverPortCode ?? null,
    },
  });
}

async function listTrackingEvents(shipmentId, opts = {}, access = {}) {
  if (!shipmentId) throw AppError.badRequest('shipmentId is required');
  const shipment = await shipmentRepository.findShipmentDetailsById(String(shipmentId).trim());
  if (!shipment) throw AppError.notFound(`Shipment ${shipmentId} not found`);
  ensureShipmentAccess(shipment, access);
  return trackingEventsRepository.listTrackingEventsByShipment(String(shipmentId).trim(), opts);
}

module.exports = {
  recordCustodyTransferMarker,
  listTrackingEvents,
};

