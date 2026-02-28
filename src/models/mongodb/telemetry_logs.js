const mongoose = require('mongoose');

// ============================================================================
// COLLECTION: telemetry_logs
// Description: Stores telemetry event logs for monitoring
// Khớp với mongodb_complete_schema.js
// ============================================================================
const telemetryLogsSchema = new mongoose.Schema({
  // Shipment ID - link to MySQL Shipments table
  shipment_id: { type: String, required: true },

  // Event type
  event_type: {
    type: String,
    enum: ['TEMP_ALERT', 'BATTERY_LOW', 'CONNECTIVITY_LOST', 'ROUTE_DEVIATION'],
    required: true,
  },

  // Event timestamp
  event_at: { type: Date, required: true, default: Date.now },

  // Event details as JSON
  details: { type: mongoose.Schema.Types.Mixed },

  // Severity level
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
});

telemetryLogsSchema.index({ shipment_id: 1, event_at: -1 });
telemetryLogsSchema.index({ event_type: 1, event_at: -1 });
telemetryLogsSchema.index({ severity: 1, event_at: -1 });

const TelemetryLogs = mongoose.model(
  'TelemetryLogs',
  telemetryLogsSchema,
  'telemetry_logs'
);

module.exports = TelemetryLogs;
