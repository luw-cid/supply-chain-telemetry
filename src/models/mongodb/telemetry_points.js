const mongoose = require('mongoose');

// ============================================================================
// COLLECTION: telemetry_points
// Description: Time-series collection storing IoT sensor data
// Khớp với mongodb_complete_schema.js
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
          validator: function (v) {
            return (
              v.length === 2 &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            );
          },
          message:
            'Invalid coordinates: [lng, lat] with lng in [-180,180] and lat in [-90,90]',
        },
      },
    },

    // Temperature (Celsius) - với validation range hợp lý
    temp: {
      type: Number,
      required: true,
      min: -100,
      max: 100,
    },

    // Humidity (%) - optional
    humidity: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  {
    timeseries: {
      timeField: 't',
      metaField: 'meta',
      granularity: 'seconds',
    },
  }
);

telemetryPointsSchema.index({ location: '2dsphere' });

const TelemetryPoints = mongoose.model(
  'TelemetryPoints',
  telemetryPointsSchema,
  'telemetry_points'
);

module.exports = TelemetryPoints;
