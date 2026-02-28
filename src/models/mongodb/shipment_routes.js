const mongoose = require('mongoose');

const shipmentRoutesSchema = new mongoose.Schema({
  // Shipment ID - link to MySQL Shipments table, REQUIRED
  shipment_id: { type: String, required: true },
  
  // Origin port code - REQUIRED, link to MySQL Ports table
  origin_port: { type: String, required: true },
  
  // Destination port code - REQUIRED, link to MySQL Ports table
  destination_port: { type: String, required: true },
  
  // Planned route - array of waypoints với estimated times
  planned_route: [{
    // Port code của waypoint
    port_code: { type: String, required: true },
    
    // Thứ tự trong route (1, 2, 3, ...)
    sequence: { type: Number, required: true },
    
    // Thời gian dự kiến đến waypoint này
    estimated_arrival: { type: Date }
  }],
  
  // Actual route - array of waypoints đã đi qua với actual times
  actual_route: [{
    // Port code của waypoint
    port_code: { type: String, required: true },
    
    // Thời gian thực tế đến
    arrival_time: { type: Date, required: true },
    
    // Thời gian thực tế rời đi - NULL nếu vẫn đang ở port
    departure_time: { type: Date }
  }],
  
  // Current position - GeoJSON Point cho real-time tracking
  current_position: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] // [lng, lat]
  },
  
  // Route status - trạng thái so với kế hoạch
  route_status: {
    type: String,
    enum: ['ON_SCHEDULE', 'DELAYED', 'DEVIATED', 'COMPLETED'],
    default: 'ON_SCHEDULE'
  },
  
  // Distance traveled (km) - tính từ origin
  distance_traveled_km: { type: Number, default: 0 },
  
  // Distance remaining (km) - tính đến destination
  distance_remaining_km: { type: Number },
  
  // Timestamp của telemetry data mới nhất
  last_telemetry_at: { type: Date },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Indexes
shipmentRoutesSchema.index({ shipment_id: 1 }, { unique: true });
shipmentRoutesSchema.index({ origin_port: 1, destination_port: 1 });
shipmentRoutesSchema.index({ route_status: 1 });
shipmentRoutesSchema.index({ current_position: '2dsphere' });
shipmentRoutesSchema.index({ last_telemetry_at: -1 });

// Pre-save middleware để update updated_at
shipmentRoutesSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const ShipmentRoutes = mongoose.model('ShipmentRoutes', shipmentRoutesSchema, 'shipment_routes');

module.exports = ShipmentRoutes;