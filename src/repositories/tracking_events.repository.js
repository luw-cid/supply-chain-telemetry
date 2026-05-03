'use strict';

const TrackingEvents = require('../models/mongodb/tracking_events');

async function insertTrackingEvent(event) {
  return TrackingEvents.create(event);
}

async function listTrackingEventsByShipment(shipmentId, { limit = 200 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  return TrackingEvents.find({ shipment_id: shipmentId })
    .sort({ t: 1 })
    .limit(lim)
    .lean();
}

module.exports = {
  insertTrackingEvent,
  listTrackingEventsByShipment,
};

