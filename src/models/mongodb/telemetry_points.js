const mongoose = require('mongoose');

const telemetryPointsSchema = new mongoose.Schema(
  {
    // Meta object - dùng làm partition key cho time-series collection
    meta: {
      // Shipment ID - link to MySQL Shipments table
      shipment_id: { type: String, required: true },
      
      // Device ID của IoT tracker - dùng để identify thiết bị cụ thể
      device_id: { type: String, required: true },
      
      // Loại sensor - default là IoT_Tracker, có thể là GPS_Only, Full_Sensor, etc.
      sensor_type: { type: String, default: 'IoT_Tracker' }
    },
    
    // Timestamp - time field cho time-series collection
    t: { type: Date, required: true },
    
    // Location as GeoJSON Point - chuẩn cho geospatial queries
    location: {
      // Type phải là 'Point' cho 2dsphere index
      type: { type: String, enum: ['Point'], default: 'Point' },
      
      // Coordinates array: [longitude, latitude] - NOTE: longitude first!
      // Ví dụ: [106.682, 10.762] cho Saigon
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
    
    // Humidity (%) - optional, không phải tất cả devices đều có sensor này
    humidity: { 
      type: Number, 
      min: 0, 
      max: 100 
    },
    
    // Atmospheric pressure (hPa) - optional, dùng cho altitude detection
    pressure: { type: Number },
    
    // Battery level (%) - dùng để alert khi pin yếu
    battery_level: { 
      type: Number, 
      min: 0, 
      max: 100 
    },
    
    // Signal strength (%) - dùng để detect connectivity issues
    signal_strength: { 
      type: Number, 
      min: 0, 
      max: 100 
    }
  },
  {
    // Time-series collection configuration
    timeseries: {
      timeField: 't',           // Field chứa timestamp
      metaField: 'meta',        // Field chứa metadata (partition key)
      granularity: 'seconds'    // Granularity level: seconds, minutes, hours
    }
  }
);

// Geospatial index cho location-based queries
// Ví dụ: Find all telemetry points within 10km of a port
telemetryPointsSchema.index({ location: '2dsphere' });

const TelemetryPoints = mongoose.model('TelemetryPoints', telemetryPointsSchema, 'telemetry_points');

module.exports = TelemetryPoints;