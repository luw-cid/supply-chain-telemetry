const mongoose = require('mongoose');

const portEdgesSchema = new mongoose.Schema({
  from_port: { type: String, required: true },
  to_port: { type: String, required: true },
  avg_hours: { type: Number, required: true },
  samples: { type: Number, required: true },
  alarm_rate: { type: Number, required: true },
});

portEdgesSchema.index({ from_port: 1, to_port: 1 }, { unique: true });

const PortEdges = mongoose.model('PortEdges', portEdgesSchema, 'port_edges');

module.exports = PortEdges;