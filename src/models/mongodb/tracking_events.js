const mongoose = require('mongoose');

// ============================================================================
// COLLECTION: tracking_events
// Description: Business markers/events for shipment tracking (not IoT telemetry)
// ============================================================================
const trackingEventSchema = new mongoose.Schema(
  {
    shipment_id: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      // BUG #7 FIX: Mở rộng enum để hỗ trợ các sự kiện nghiệp vụ thực tế.
      // Giữ CUSTODY_TRANSFER backward-compatible; thêm các loại cần thiết.
      enum: [
        'CUSTODY_TRANSFER',   // Bàn giao quyền giữ hàng giữa các bên
        'PORT_ARRIVAL',       // Tàu đến cảng
        'PORT_DEPARTURE',     // Tàu rời cảng
        'CUSTOMS_CLEARED',    // Thông quan xuất/nhập khẩu
        'DELAY',              // Trễ chẳng so với lịch trình
        'DAMAGE_REPORTED',    // Phát hiện hư hỏng hàng hóa
      ],
    },
    t: { type: Date, required: true, default: () => new Date() },
    // Optional location. If we can derive from current port, store coordinates.
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number],
        required: false,
        validate: {
          validator: function (v) {
            if (v == null) return true;
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              typeof v[0] === 'number' &&
              typeof v[1] === 'number' &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            );
          },
          message: 'Invalid coordinates: [lng, lat]',
        },
      },
    },
    port_code: { type: String, required: false },
    label: { type: String, required: false },
    payload: { type: Object, required: false },
  },
  { collection: 'tracking_events' },
);

trackingEventSchema.index({ shipment_id: 1, t: -1 });
trackingEventSchema.index({ location: '2dsphere' }, { sparse: true });

const TrackingEvents = mongoose.model('TrackingEvents', trackingEventSchema, 'tracking_events');

module.exports = TrackingEvents;

