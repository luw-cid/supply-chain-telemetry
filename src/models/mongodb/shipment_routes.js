const mongoose = require('mongoose');

const shipmentRoutesSchema = new mongoose.Schema({
  shipment_id: { type: String, required: true },
  origin_port: { type: String },
  destination_port: { type: String },
  last_telemetry_at: { type: Date },
});

shipmentRoutesSchema.index({ shipment_id: 1 }, { unique: true });

const ShipmentRoutes = mongoose.model('ShipmentRoutes', shipmentRoutesSchema, 'shipment_routes');

module.exports = ShipmentRoutes;