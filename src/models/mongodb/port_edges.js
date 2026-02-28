const mongoose = require('mongoose');

// ============================================================================
// COLLECTION: port_edges
// Description: Stores statistical data about routes between ports
// Khớp với mongodb_complete_schema.js
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
    default: 'SEA',
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
    max: 1,
  },

  // Last updated timestamp
  last_updated: { type: Date, default: Date.now },

  // Is active flag
  is_active: { type: Boolean, default: true },
});

portEdgesSchema.index({ from_port: 1, to_port: 1 }, { unique: true });
portEdgesSchema.index({ alarm_rate: -1 });
portEdgesSchema.index({ avg_hours: 1 });
portEdgesSchema.index({ route_type: 1 });
portEdgesSchema.index({ is_active: 1 });

const PortEdges = mongoose.model('PortEdges', portEdgesSchema, 'port_edges');

module.exports = PortEdges;
