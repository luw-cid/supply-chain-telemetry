const mongoose = require('mongoose');

// ============================================================================
// COLLECTION: telemetry_points
// Description: Time-series collection storing IoT sensor data
// Khớp với mongodb_complete_schema.js
// ============================================================================
const telemetryPointsSchema = new mongoose.Schema(
  {
    meta: {
      shipment_id: { type: String, required: true },
      device_id: { type: String, required: true },
    },

    t: { type: Date, required: true },

    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
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

    temp: {
      type: Number,
      required: true,
      min: -100,
      max: 100,
    },

    humidity: {
      type: Number,
      min: 0,
      max: 100,
    },

    idempotency_key: {
      type: String,
      sparse: true,
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
