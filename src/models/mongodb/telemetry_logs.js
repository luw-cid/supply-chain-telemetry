const mongoose = require('mongoose');

const telemetryLogsSchema = new mongoose.Schema({
  shipment_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  event_type: { 
    type: String, 
    enum: [
      'TEMP_ALERT',           // Temperature violation detected
      'TEMP_RECOVERED',       // Temperature back to normal range
      'LOCATION_UPDATE',      // Significant location change
      'SENSOR_ERROR',         // Sensor malfunction
      'BATTERY_LOW',          // Device battery below threshold
      'CONNECTIVITY_LOST',    // Lost connection to tracking device
      'CONNECTIVITY_RESTORED',// Connection restored
      'ROUTE_DEVIATION',      // Shipment off expected route
      'PORT_ARRIVAL',         // Arrived at port
      'PORT_DEPARTURE',       // Departed from port
      'MANUAL_CHECKIN',       // Manual status update
      'SYSTEM_ALERT'          // General system notification
    ],
    required: true 
  },
  severity: { 
    type: String, 
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    required: true,
    default: 'INFO'
  },
  message: { 
    type: String,
    required: true
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: { 
    type: Date, 
    default: Date.now, 
    required: true,
    index: true
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledged_by: {
    type: String,
    default: null
  },
  acknowledged_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound indexes for common queries
telemetryLogsSchema.index({ shipment_id: 1, timestamp: -1 }); // Recent logs for shipment
telemetryLogsSchema.index({ event_type: 1, timestamp: -1 });  // Logs by type
telemetryLogsSchema.index({ severity: 1, acknowledged: 1 });  // Unacknowledged alerts
telemetryLogsSchema.index({ shipment_id: 1, event_type: 1, timestamp: -1 }); // Specific event history

// TTL Index - automatically delete logs older than 90 days (7776000 seconds)
telemetryLogsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// Virtual for human-readable timestamp
telemetryLogsSchema.virtual('timestamp_formatted').get(function() {
  return this.timestamp.toISOString();
});

// Instance method to acknowledge a log entry
telemetryLogsSchema.methods.acknowledge = function(userId) {
  this.acknowledged = true;
  this.acknowledged_by = userId;
  this.acknowledged_at = new Date();
  return this.save();
};

// Static method to create log entry
telemetryLogsSchema.statics.createLog = async function(logData) {
  const log = new this(logData);
  return await log.save();
};

// Static method to get unacknowledged critical alerts
telemetryLogsSchema.statics.getCriticalAlerts = function(shipmentId = null) {
  const query = {
    severity: 'CRITICAL',
    acknowledged: false
  };
  
  if (shipmentId) {
    query.shipment_id = shipmentId;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

// Static method to get logs by shipment with pagination
telemetryLogsSchema.statics.getShipmentLogs = function(shipmentId, options = {}) {
  const {
    page = 1,
    limit = 50,
    eventType = null,
    severity = null,
    startDate = null,
    endDate = null
  } = options;

  const query = { shipment_id: shipmentId };
  
  if (eventType) query.event_type = eventType;
  if (severity) query.severity = severity;
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Pre-save hook for validation
telemetryLogsSchema.pre('save', function(next) {
  // Ensure metadata is an object
  if (this.metadata && typeof this.metadata !== 'object') {
    return next(new Error('Metadata must be an object'));
  }
  
  // Auto-set severity based on event_type if not provided
  if (!this.severity) {
    const criticalEvents = ['TEMP_ALERT', 'SENSOR_ERROR', 'CONNECTIVITY_LOST'];
    const warningEvents = ['BATTERY_LOW', 'ROUTE_DEVIATION'];
    
    if (criticalEvents.includes(this.event_type)) {
      this.severity = 'CRITICAL';
    } else if (warningEvents.includes(this.event_type)) {
      this.severity = 'WARNING';
    } else {
      this.severity = 'INFO';
    }
  }
  
  next();
});

const TelemetryLogs = mongoose.model('TelemetryLogs', telemetryLogsSchema, 'telemetry_logs');

module.exports = TelemetryLogs;