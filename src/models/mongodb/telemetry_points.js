const mongoose = require('mongoose');

const telemetryPointsSchema = new mongoose.Schema(
  {
    meta: {
      shipment_id: { type: String, required: true },
    },
    t: { type: Date, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    temp: { type: Number, required: true },
  },
  {
    timeseries: {
      timeField: 't',
      metaField: 'meta',
      granularity: 'seconds',
    },
  }
);

const TelemetryPoints = mongoose.model('TelemetryPoints', telemetryPointsSchema, 'telemetry_points');

module.exports = TelemetryPoints;