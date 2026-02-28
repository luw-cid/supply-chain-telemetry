const mongoose = require('mongoose');

// ============================================================================
// COLLECTION: shipment_routes
// Description: Stores shipment route information and tracking
// Khớp với mongodb_complete_schema.js
// ============================================================================
const shipmentRoutesSchema = new mongoose.Schema({
  // Shipment ID - link to MySQL Shipments table, REQUIRED
  shipment_id: { type: String, required: true },

  // Origin port code - REQUIRED
  origin_port: { type: String, required: true },

  // Destination port code - REQUIRED
  destination_port: { type: String, required: true },

  // Planned route - array of waypoints với estimated times
  planned_route: [
    {
      port_code: { type: String, required: true },
      sequence: { type: Number, required: true },
      estimated_arrival: { type: Date },
    },
  ],

  // Actual route - array of waypoints đã đi qua
  actual_route: [
    {
      port_code: { type: String, required: true },
      arrival_time: { type: Date, required: true },
      departure_time: { type: Date },
    },
  ],

  // Current position - GeoJSON Point
  current_position: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number], // [lng, lat]
  },

  // Route status - trạng thái so với kế hoạch
  route_status: {
    type: String,
    enum: ['ON_SCHEDULE', 'DELAYED', 'DEVIATED', 'COMPLETED'],
    default: 'ON_SCHEDULE',
  },

  // Timestamp của telemetry data mới nhất
  last_telemetry_at: { type: Date },

  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

shipmentRoutesSchema.index({ shipment_id: 1 }, { unique: true });
shipmentRoutesSchema.index({ origin_port: 1, destination_port: 1 });
shipmentRoutesSchema.index({ route_status: 1 });
shipmentRoutesSchema.index({ current_position: '2dsphere' });
shipmentRoutesSchema.index({ last_telemetry_at: -1 });

shipmentRoutesSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const ShipmentRoutes = mongoose.model(
  'ShipmentRoutes',
  shipmentRoutesSchema,
  'shipment_routes'
);

module.exports = ShipmentRoutes;
