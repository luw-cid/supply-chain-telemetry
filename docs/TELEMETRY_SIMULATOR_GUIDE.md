# 📡 Hướng Dẫn Sử Dụng Telemetry Simulator

## Tổng Quan

Telemetry Simulator cho phép bạn mô phỏng dữ liệu IoT từ thiết bị cảm biến, bao gồm nhiệt độ, độ ẩm và **tọa độ GPS di chuyển**.

## Tính Năng Mới: Mô Phỏng Chuyển Động 🚢

### 1. Location Mode

#### **Fixed Mode** (Cố định)
- Tọa độ không thay đổi giữa các lần gửi
- Sử dụng tọa độ marker của shipment
- Phù hợp cho: Test cơ bản, shipment đứng yên

#### **Moving Mode** (Di chuyển) ⭐ MỚI
- Tọa độ thay đổi theo từng lần gửi
- Mô phỏng chuyển động thực tế của lô hàng
- Phù hợp cho: Test trace route, tracking map

### 2. Cấu Hình Moving Mode

#### **Start Longitude / Start Latitude**
- Tọa độ điểm bắt đầu
- Tự động điền từ shipment marker khi chuyển sang Moving mode
- Có thể chỉnh sửa thủ công

#### **Lng Step / Lat Step** (Bước tăng/giảm)
- Độ thay đổi tọa độ mỗi lần gửi
- Giá trị dương: di chuyển về hướng Đông/Bắc
- Giá trị âm: di chuyển về hướng Tây/Nam
- Đơn vị: độ (degrees)

### 3. Công Thức Tính Toán

```
Lần gửi thứ i:
  Longitude = Start Longitude + (Lng Step × i)
  Latitude  = Start Latitude  + (Lat Step × i)
```

**Ví dụ:**
- Start: `[106.7, 10.8]`
- Step: `[0.1, 0.1]`
- Count: 5

Kết quả:
```
Lần 0: [106.7, 10.8]
Lần 1: [106.8, 10.9]
Lần 2: [106.9, 11.0]
Lần 3: [107.0, 11.1]
Lần 4: [107.1, 11.2]
```

## Các Trường Hợp Sử Dụng

### Test 1: Shipment Di Chuyển Từ Singapore → Hong Kong
```
Location Mode: Moving
Start Longitude: 103.82  (Singapore)
Start Latitude:  1.35
Lng Step: 0.3
Lat Step: 0.6
Send Count: 30
Interval: 3s
```

### Test 2: Shipment Di Chuyển Ngược (Bắc → Nam)
```
Location Mode: Moving
Start Longitude: 139.64  (Tokyo)
Start Latitude:  35.44
Lng Step: -0.5   (về phía Tây)
Lat Step: -0.2   (về phía Nam)
Send Count: 20
```

### Test 3: Shipment Đứng Yên (Cảng)
```
Location Mode: Fixed
(Sử dụng marker của shipment)
```

## Kết Hợp Với Temperature Mode

### Sequential Temperature + Moving Location
Mô phỏng nhiệt độ tăng dần khi di chuyển qua vùng nóng:
```
Temperature Mode: Sequential
  Start: 5°C
  End: 20°C
  Step: 1°C

Location Mode: Moving
  Start: [103.82, 1.35]
  Lng Step: 0.2
  Lat Step: 0.3
```

### Random Temperature + Moving Location
Mô phỏng nhiệt độ dao động trong quá trình vận chuyển:
```
Temperature Mode: Random
  Min: 2°C
  Max: 15°C

Location Mode: Moving
  Start: [106.7, 10.8]
  Lng Step: 0.15
  Lat Step: 0.25
```

## Lưu Ý Kỹ Thuật

### Độ Chính Xác Tọa Độ
- Tọa độ được làm tròn đến 6 chữ số thập phân
- Độ chính xác: ~0.11 mét

### Giới Hạn Tọa Độ
- Longitude: -180° đến 180°
- Latitude: -90° đến 90°
- Hệ thống sẽ validate khi lưu vào MongoDB

### Bước Tăng/Giảm Hợp Lý
- **Nhỏ** (0.01 - 0.05): Di chuyển chậm, chi tiết
- **Trung bình** (0.1 - 0.3): Di chuyển bình thường
- **Lớn** (0.5 - 1.0): Di chuyển nhanh, khoảng cách xa

### Tham Khảo Khoảng Cách
```
1° Longitude ≈ 111 km (tại xích đạo)
1° Latitude  ≈ 111 km
0.1° ≈ 11 km
0.01° ≈ 1.1 km
```

## Kiểm Tra Kết Quả

### 1. Xem Trên Tracking Map
- Vào trang **Tracking Map**
- Chọn shipment vừa test
- Xem đường đi của lô hàng

### 2. Xem Trên Trace Route
- Vào **Shipment Detail**
- Tab **Trace Route**
- Xem timeline di chuyển với tọa độ

### 3. Query MongoDB
```javascript
db.telemetry_points.find(
  { "meta.shipment_id": "SHP-001" },
  { "location.coordinates": 1, "t": 1, "temp": 1 }
).sort({ t: 1 })
```

## Troubleshooting

### Tọa độ không thay đổi?
- Kiểm tra **Location Mode** = "Moving"
- Kiểm tra **Lng Step** và **Lat Step** ≠ 0

### Tọa độ nhảy quá xa?
- Giảm giá trị **Step** xuống
- Tăng **Send Count** để có nhiều điểm hơn

### Muốn di chuyển theo tuyến cụ thể?
- Tính toán Step dựa trên điểm đầu/cuối:
  ```
  Lng Step = (End Lng - Start Lng) / Count
  Lat Step = (End Lat - Start Lat) / Count
  ```

## So Sánh Với Seed Script

| Tính năng | Simulator | Seed Script |
|-----------|-----------|-------------|
| Tọa độ | Linear interpolation | Route-based interpolation |
| Linh hoạt | Cao (UI) | Thấp (code) |
| Số lượng điểm | 1-100 | 100-1000+ |
| Use case | Test thủ công | Test tự động, demo |

---

**Cập nhật:** 2026-05-14  
**Version:** 2.0 - Thêm Moving Location Mode
