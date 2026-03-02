// ============================================================================
// COMPLETE MongoDB SCHEMA FOR GLOBAL SUPPLY CHAIN & ASSET TELEMETRY SYSTEM
// ============================================================================
// Description: Consolidated schema file containing all collections
// Database: supply_chain_mongo
// Created: 2026-02-25
// ============================================================================

const mongoose = require('mongoose');

// ============================================================================
// COLLECTION: telemetry_points
// Description: Time-series collection storing IoT sensor data
// ============================================================================
const telemetryPointsSchema = new mongoose.Schema(
  {
    // Meta object - dùng làm partition key cho time-series collection
    meta: {
      // Shipment ID - link to MySQL Shipments table
      shipment_id: { type: String, required: true },
      
      // Device ID của IoT tracker - dùng để identify thiết bị cụ thể
      device_id: { type: String, required: true },
      
    },
    
    // Timestamp - time field cho time-series collection
    t: { type: Date, required: true },
    
    // Location as GeoJSON Point - chuẩn cho geospatial queries
    location: {
      // Type phải là 'Point' cho 2dsphere index
      type: { type: String, enum: ['Point'], default: 'Point' },
      
      // Coordinates array: [longitude, latitude] - NOTE: longitude first!
      coordinates: { 
        type: [Number], 
        required: true,
        validate: {
          validator: function(v) {
            // Validate array length và ranges
            return v.length === 2 && 
                   v[0] >= -180 && v[0] <= 180 &&  // longitude range
                   v[1] >= -90 && v[1] <= 90;      // latitude range
          },
          message: 'Invalid coordinates: [lng, lat] with lng in [-180,180] and lat in [-90,90]'
        }
      }
    },
    
    // Temperature (Celsius) - với validation range hợp lý
    temp: { 
      type: Number, 
      required: true,
      min: -100,  // Extreme cold (e.g., dry ice transport)
      max: 100    // Extreme heat
    },
    
    // Humidity (%) - optional
    humidity: { 
      type: Number, 
      min: 0, 
      max: 100 
    },
    
    // Battery level (%) - dùng để alert khi pin yếu
    // battery_level: { 
    //   type: Number, 
    //   min: 0, 
    //   max: 100 
    // },
    
    // Signal strength (%) - dùng để detect connectivity issues
    // signal_strength: { 
    //   type: Number, 
    //   min: 0, 
    //   max: 100 
    // }
  },
  {
    // Time-series collection configuration
    timeseries: {
      timeField: 't',           // Field chứa timestamp
      metaField: 'meta',        // Field chứa metadata (partition key)
      granularity: 'seconds'    // Granularity level
    }
  }
);

// Geospatial index cho location-based queries
telemetryPointsSchema.index({ location: '2dsphere' });

const TelemetryPoints = mongoose.model('TelemetryPoints', telemetryPointsSchema, 'telemetry_points');

// ============================================================================
// COLLECTION: shipment_routes
// Description: Stores shipment route information and tracking
// ============================================================================
const shipmentRoutesSchema = new mongoose.Schema({
  // Shipment ID - link to MySQL Shipments table, REQUIRED
  shipment_id: { type: String, required: true },
  
  // Origin port code - REQUIRED
  origin_port: { type: String, required: true },
  
  // Destination port code - REQUIRED
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
  
  // Actual route - array of waypoints đã đi qua
  actual_route: [{
    // Port code của waypoint
    port_code: { type: String, required: true },
    
    // Thời gian thực tế đến
    arrival_time: { type: Date, required: true },
    
    // Thời gian thực tế rời đi
    departure_time: { type: Date }
  }],
  
  // Current position - GeoJSON Point
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

// ============================================================================
// COLLECTION: port_edges
// Description: Stores statistical data about routes between ports
// ============================================================================
const portEdgesSchema = new mongoose.Schema({
  // From port code - link to MySQL Ports table
  from_port: { type: String, required: true },
  
  // To port code - link to MySQL Ports table
  to_port: { type: String, required: true },
  
  // Route type - loại phương tiện vận chuyển
  route_type: { 
    type: String, 
    enum: ['SEA', 'AIR', 'LAND', 'MULTIMODAL'],
    default: 'SEA'
  },
  
  // Distance (km) - khoảng cách thực tế giữa 2 ports
  distance_km: { type: Number, required: true },
  
  // Average transit time (hours)
  avg_hours: { type: Number, required: true },
  
  // Minimum transit time (hours)
  min_hours: { type: Number },
  
  // Maximum transit time (hours)
  max_hours: { type: Number },
  
  // Standard deviation (hours)
  std_dev_hours: { type: Number },
  
  // Number of samples
  samples: { type: Number, required: true },
  
  // Alarm rate (0-1)
  alarm_rate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1
  },
  
  // Last updated timestamp
  last_updated: { type: Date, default: Date.now },
  
  // Is active flag
  is_active: { type: Boolean, default: true }
});

// Indexes
portEdgesSchema.index({ from_port: 1, to_port: 1 }, { unique: true });
portEdgesSchema.index({ alarm_rate: -1 }); // High-risk routes first
portEdgesSchema.index({ avg_hours: 1 });   // Fastest routes first
portEdgesSchema.index({ route_type: 1 });
portEdgesSchema.index({ is_active: 1}); // Active routes by cost

const PortEdges = mongoose.model('PortEdges', portEdgesSchema, 'port_edges');

// ============================================================================
// COLLECTION: telemetry_logs
// Description: Stores telemetry event logs for monitoring
// ============================================================================
const telemetryLogsSchema = new mongoose.Schema({
  // Shipment ID - link to MySQL Shipments table
  shipment_id: { type: String, required: true },
  
  // Event type
  event_type: { 
    type: String, 
    enum: ['TEMP_ALERT', 'BATTERY_LOW', 'CONNECTIVITY_LOST', 'ROUTE_DEVIATION'],
    required: true 
  },
  
  // Event timestamp
  event_at: { type: Date, required: true, default: Date.now },
  
  // Event details as JSON
  details: { type: mongoose.Schema.Types.Mixed },
  
  // Severity level
  severity: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  }
});

// Indexes
telemetryLogsSchema.index({ shipment_id: 1, event_at: -1 });
telemetryLogsSchema.index({ event_type: 1, event_at: -1 });
telemetryLogsSchema.index({ severity: 1, event_at: -1 });

const TelemetryLogs = mongoose.model('TelemetryLogs', telemetryLogsSchema, 'telemetry_logs');

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  TelemetryPoints,
  ShipmentRoutes,
  PortEdges,
  TelemetryLogs
};

// ============================================================================
// USAGE EXAMPLE
// ============================================================================
/*
const mongoose = require('mongoose');
const { TelemetryPoints, ShipmentRoutes, PortEdges, TelemetryLogs } = require('./mongodb_complete_schema');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/supply_chain_mongo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Example: Insert telemetry point
const telemetryPoint = new TelemetryPoints({
  meta: {
    shipment_id: 'SHP-001',
    device_id: 'DEV-12345'
  },
  t: new Date(),
  location: {
    type: 'Point',
    coordinates: [106.682, 10.762] // [lng, lat] - Saigon
  },
  temp: -70.5,
  humidity: 45.2,
  signal_strength: 92
});

telemetryPoint.save()
  .then(() => console.log('Telemetry point saved'))
  .catch(err => console.error('Error:', err));

// Example: Create shipment route
const shipmentRoute = new ShipmentRoutes({
  shipment_id: 'SHP-001',
  origin_port: 'VNSGN',
  destination_port: 'USNYC',
  planned_route: [
    { port_code: 'VNSGN', sequence: 1, estimated_arrival: new Date('2026-03-01') },
    { port_code: 'SGSIN', sequence: 2, estimated_arrival: new Date('2026-03-05') },
    { port_code: 'USNYC', sequence: 3, estimated_arrival: new Date('2026-03-20') }
  ],
  route_status: 'ON_SCHEDULE',
  current_position: {
    type: 'Point',
    coordinates: [106.682, 10.762]
  }
});

shipmentRoute.save()
  .then(() => console.log('Shipment route created'))
  .catch(err => console.error('Error:', err));

// Example: Create port edge
const portEdge = new PortEdges({
  from_port: 'VNSGN',
  to_port: 'SGSIN',
  route_type: 'SEA',
  distance_km: 1080,
  avg_hours: 72,
  min_hours: 60,
  max_hours: 96,
  std_dev_hours: 8.5,
  samples: 150,
  alarm_rate: 0.05,
  is_active: true
});

portEdge.save()
  .then(() => console.log('Port edge created'))
  .catch(err => console.error('Error:', err));
*/
