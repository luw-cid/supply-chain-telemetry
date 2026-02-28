const mongoose = require('mongoose');

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
  
  // Average transit time (hours) - trung bình từ historical data
  avg_hours: { type: Number, required: true },
  
  // Minimum transit time (hours) - fastest recorded
  min_hours: { type: Number },
  
  // Maximum transit time (hours) - slowest recorded
  max_hours: { type: Number },
  
  // Standard deviation (hours) - đo độ biến động của transit time
  // Giá trị cao = route không ổn định
  std_dev_hours: { type: Number },
  
  // Number of samples - số lượng shipments đã đi qua route này
  // Dùng để đánh giá độ tin cậy của statistics
  samples: { type: Number, required: true },
  
  // Alarm rate (0-1) - tỷ lệ shipments bị alarm trên route này
  // Ví dụ: 0.05 = 5% shipments bị alarm
  alarm_rate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1
  },
  
  // Average cost (USD) - chi phí trung bình cho route này
  avg_cost_usd: { type: Number },
  
  // Carrier count - số lượng carriers phục vụ route này
  // Giá trị cao = nhiều lựa chọn
  carrier_count: { type: Number, default: 0 },
  
  // Last updated timestamp - khi nào statistics được update lần cuối
  last_updated: { type: Date, default: Date.now },
  
  // Is active flag - route có đang hoạt động không
  // false = route bị đóng hoặc không khả dụng
  is_active: { type: Boolean, default: true }
});

// Indexes
portEdgesSchema.index({ from_port: 1, to_port: 1 }, { unique: true });
portEdgesSchema.index({ alarm_rate: -1 }); // High-risk routes first
portEdgesSchema.index({ avg_hours: 1 });   // Fastest routes first
portEdgesSchema.index({ route_type: 1 });
portEdgesSchema.index({ is_active: 1, avg_cost_usd: 1 }); // Active routes by cost

const PortEdges = mongoose.model('PortEdges', portEdgesSchema, 'port_edges');

module.exports = PortEdges;