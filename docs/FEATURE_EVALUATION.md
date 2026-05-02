# Đánh giá chức năng hệ thống & thống kê phần còn thiếu

Tài liệu này tổng hợp **các chức năng hiện có** (dựa trên code trong repo) và **các chức năng còn thiếu/đề xuất** để hoàn thiện sản phẩm.

## Phạm vi & cách chấm

- **Phạm vi**: UI (React) + các API mà UI đang gọi + mô tả backend trong `README.md`/`docs/`.
- **Thang điểm (0–10)**:
  - **9–10**: hoàn thiện, ít rủi ro, UX tốt, có đủ guard/edge-cases.
  - **7–8**: dùng được, còn thiếu vài workflow/edge-case.
  - **5–6**: có “khung”/demo, thiếu nhiều phần để vận hành thật.
  - **<5**: mới là ý tưởng/đầu nối, chưa sẵn sàng.

## Bảng đánh giá các chức năng hiện có

> Ghi chú: “Đã nối API” nghĩa là có lời gọi API từ frontend (thường qua `frontend/src/api/*.ts`).

| Nhóm | Chức năng | Hiện trạng (theo repo) | Đã nối API | Điểm | Rủi ro / Ghi chú | File chính (tham chiếu) |
|---|---|---|---:|---:|---|---|
| Auth/RBAC | Đăng nhập/đăng ký + lưu phiên | Có login/register, lưu JWT + user localStorage, tự gọi `fetchMe()` khi có token | Có | 7.5 | JWT lưu localStorage (rủi ro XSS); cần harden (CSP/sanitize/httpOnly cookie tùy kiến trúc) | `frontend/src/contexts/AuthContext.tsx`, `frontend/src/api/client.ts` |
| Auth/RBAC | Bảo vệ route + menu theo vai trò | Có `RequireAuth` + `RoleGuard`, menu items theo role (OWNER/ADMIN/LOGISTICS/AUDITOR) | Có | 8 | Cần đảm bảo **backend** cũng enforce RBAC; UI chỉ là lớp bảo vệ đầu | `frontend/src/App.tsx`, `frontend/src/layouts/MainLayout.tsx`, `frontend/src/components/RoleGuard.tsx` |
| Dashboard | Tổng quan shipment + cảnh báo OPEN | Có metrics, bảng cảnh báo OPEN, có refresh 60s, link tới shipment | Có | 8 | Phụ thuộc dữ liệu `AlarmEvents`; cần SLA/hiệu năng khi dữ liệu lớn | `frontend/src/pages/DashboardPage.tsx`, `frontend/src/api/alarms.ts` |
| Dashboard/Map | Bản đồ tổng quan (Fleet + Ports) | Có map `mapbox-gl`, marker shipments + ports (theo role) | Có | 7 | Khi số marker lớn cần clustering; cần xử lý token map/giới hạn dịch vụ | `frontend/src/components/GlobalFleetMap.tsx` |
| Shipments | Danh sách + lọc + tìm kiếm | Có filter status, search ShipmentID, phân trang | Có | 8 | UX tốt; cần chuẩn hóa search server-side và index DB | `frontend/src/pages/ShipmentsPage.tsx`, `frontend/src/api/shipments.ts` |
| Shipments | Tạo shipment (ADMIN) | Có modal form tạo mới (cargo profile, parties, ports…) | Có | 7.5 | Thiếu validate nghiệp vụ sâu (VD: origin/destination khác nhau, party status) nếu backend chưa có | `frontend/src/pages/ShipmentsPage.tsx` |
| Shipment detail | Chi tiết shipment | Có hiển thị mô tả + status + CTA bàn giao theo role/trạng thái | Có | 8 | Cần chuẩn hóa schema fields (đang dùng `Record<string, unknown>`) để type-safety | `frontend/src/pages/ShipmentDetailPage.tsx`, `frontend/src/api/shipments.ts` |
| Analytics/Map | Trace route (hành trình thực tế) | Có tab “Trace”, gọi API trả GeoJSON, vẽ tuyến & marker | Có | 7.5 | Phụ thuộc chất lượng telemetry_points; cần xử lý trường hợp nhiều điểm (performance) | `frontend/src/api/telemetry.ts`, `frontend/src/components/TraceRouteMap.tsx` |
| Telemetry | Telemetry logs + biểu đồ IoT | Có gọi logs theo trang + chart (min/max temp) | Có | 7 | Cần tối ưu tải dữ liệu (downsample), lọc theo thời gian, export | `frontend/src/api/telemetry.ts`, `frontend/src/components/TelemetryIoTChart.tsx` |
| Telemetry/Alarms | Thu thập data từ sensor (ingestion) + kích hoạt cảnh báo | Có endpoint ingest theo saga: ghi MongoDB → đọc ngưỡng từ MySQL → nếu vi phạm set shipment ALARM (trigger) + ghi outbox event | Có (backend) | 7 | Endpoint ingest hiện không thấy middleware auth/rate-limit; cần idempotency, chống replay, kiểm soát out-of-order timestamp, và giới hạn payload | `src/routes/telemetry.route.js`, `src/services/saga-orchestrator.js`, `src/database/sql/triggers_violation_and_custody.sql` |
| Custody | Xem chuỗi sở hữu (timeline) | Có trang tổng quan + trong shipment detail, map chain → events | Có | 7.5 | Phụ thuộc MySQL recursive CTE + dữ liệu chuẩn; cần đồng bộ “trạng thái ACTIVE” rõ ràng | `frontend/src/pages/ChainCustodyPage.tsx`, `frontend/src/components/CustodyTimeline.tsx` |
| Custody | Chuyển giao custody (legal handover) | Có form transfer, prefill fromPartyId, port, chặn ALARM, upload chữ ký base64 | Có | 8 | Base64 file có thể lớn; cần giới hạn size/loại file + lưu trữ an toàn | `frontend/src/pages/CustodyTransferPage.tsx`, `frontend/src/api/custody.ts` |
| Master data | Quản lý Ports | CRUD ports, ADMIN được sửa/xóa/thêm; role khác chỉ xem | Có | 7 | Cần ràng buộc referential integrity + soft delete nếu có tham chiếu | `frontend/src/pages/PortsPage.tsx`, `frontend/src/api/reference.ts` |
| Master data | Quản lý Parties | Xem full list theo role; tạo/sửa cho ADMIN/LOGISTICS | Có | 7 | Nên có tìm kiếm, phân trang server-side; chuẩn hóa trạng thái ACTIVE/INACTIVE | `frontend/src/pages/PartiesPage.tsx`, `frontend/src/api/reference.ts` |
| Audit/Alerts | Audit logs | Có bảng audit, lọc thời gian, phân trang | Có | 7 | Thiếu filter theo bảng/user/record; thiếu “xem chi tiết diff” dễ đọc | `frontend/src/pages/AuditAlertsPage.tsx`, `frontend/src/api/audit.ts` |
| Audit/Alerts | Alarms (liệt kê) | Có bảng alarms + lọc thời gian | Có | 7 | Thiếu workflow “ack/close/assign”, SLA xử lý, severity policy | `frontend/src/pages/AuditAlertsPage.tsx`, `frontend/src/api/alarms.ts` |
| Analytics | Route optimization | Chọn origin/destination, hiển thị top routes + KPI | Có | 6.5 | Thiếu tùy chỉnh constraints (max stops/alarm rate) trên UI; thiếu map visualize route | `frontend/src/pages/RouteOptimizationPage.tsx`, `frontend/src/api/telemetry.ts` |
| UI | Dark mode | Có toggle dark/light trong layout | Có (client-side) | 8 | Nên lưu preference vào storage + đồng bộ hệ thống design tokens | `frontend/src/contexts/ThemeContext.tsx`, `frontend/src/layouts/MainLayout.tsx` |

## Thống kê chức năng còn thiếu (backlog gợi ý)

### 1) Chức năng “có file nhưng chưa dùng / chưa nối route”

- **Tracking Map page chưa được route tới**: file `frontend/src/pages/TrackingMapPage.tsx` tồn tại nhưng không thấy khai báo trong `frontend/src/App.tsx`.
- **Một số page có nhưng không “expose”**: `frontend/src/pages/AlertsPage.tsx`, `frontend/src/pages/AnalyticsPage.tsx` xuất hiện trong repo nhưng không thấy nằm trong router hiện tại.

### 2) Workflow vận hành còn thiếu (khuyến nghị ưu tiên cao)

- **Alarms lifecycle**:
  - Ack/Assign/Close alarm, ghi người xử lý + thời gian
  - SLA dashboard (alarm aging), filter theo severity/loại
- **Shipment lifecycle**:
  - Cập nhật trạng thái (IN_TRANSIT/COMPLETED/ALARM) có workflow rõ ràng
  - Quy tắc “khóa bàn giao” khi ALARM (đã có) cần kèm luồng “xử lý ALARM” để mở khóa
- **Telemetry quản trị**:
  - Lọc theo thời gian, export CSV, downsampling/aggregation theo khoảng thời gian
  - “Device management” (thiết bị, mapping device ↔ shipment) nếu đây là yêu cầu vận hành thật

### 2.1) Checklist kiểm tra: thu thập sensor → cảnh báo (ingestion → ALARM)

> Mục tiêu: kiểm tra “end-to-end” từ lúc thiết bị gửi dữ liệu đến khi hệ thống tạo cảnh báo và khóa nghiệp vụ liên quan.

- **API ingest hoạt động**:
  - Gọi `POST /api/v1/telemetry/ingest` với payload tối thiểu: `shipment_id`, `device_id`, `timestamp?`, `location{lng,lat}`, `temp`, `humidity?`.
  - Kỳ vọng: trả `success` và có `mongo_point_id`, `violation` (xem `src/services/saga-orchestrator.js`).
- **Ghi dữ liệu MongoDB**:
  - Kiểm tra collection `telemetry_points` có thêm điểm mới theo `meta.shipment_id`.
  - Kiểm tra index/2dsphere location (nếu có) để không degrade truy vấn trace.
- **Ngưỡng nhiệt độ & phân loại vi phạm**:
  - Test biên: \(temp = tempMax\) (không vi phạm) vs \(temp = tempMax + \epsilon\) (vi phạm).
  - Test dữ liệu thiếu ngưỡng: shipment không có `TempMax` → trả lỗi notFound (đang làm như vậy).
- **Kích hoạt ALARM & dữ liệu cảnh báo**:
  - Khi vi phạm: `Shipments.LastTelemetryStatus` set `VIOLATION` → trigger `TRG_CHECK_VIOLATION` set `Shipments.Status='ALARM'` và `AlarmAtUTC/AlarmReason`.
  - Kiểm tra bảng `AlarmEvents` có bản ghi mới (nếu outbox processor / hoặc service tạo sự kiện đã chạy).
- **Chặn bàn giao khi ALARM**:
  - Test: gọi transfer custody khi shipment `ALARM` phải bị chặn bởi trigger `TRG_BLOCK_CUSTODY_WHEN_ALARM` (409/45000 tùy mapping).
- **Idempotency & trùng lặp** (khuyến nghị bổ sung nếu chưa có):
  - Gửi cùng 1 điểm nhiều lần (replay) không nên tạo nhiều alarm/outbox trùng.
  - Có khóa theo `(shipment_id, device_id, timestamp)` hoặc requestId từ thiết bị.
- **Out-of-order timestamp** (khuyến nghị):
  - Gửi điểm cũ hơn điểm mới gần nhất: hệ thống nên vẫn lưu nhưng cần quy tắc “điểm nào được coi là current” để tránh flip trạng thái.
- **Bảo mật & vận hành ingest** (khuyến nghị):
  - Bắt buộc auth (API key/JWT/MTLS) hoặc ít nhất rate limit + allowlist.
  - Validate `location` (lat/lng range), validate temp/humidity range, giới hạn kích thước payload.

### 3) Tăng độ an toàn & tuân thủ (security/compliance)

- **Token security**: cân nhắc chuyển sang httpOnly cookie hoặc bổ sung CSP + sanitize + dependency audit.
- **File upload chữ ký**:
  - Giới hạn kích thước/định dạng
  - Lưu trữ an toàn (object storage), tránh giữ base64 quá lớn trong DB/log
- **RBAC end-to-end**: đảm bảo mọi endpoint enforce role/party scope ở backend (không chỉ UI).

### 4) Khả năng mở rộng & hiệu năng

- **Map performance**: clustering/virtualization khi nhiều shipments/ports; tối ưu fitBounds, cleanup markers.
- **Telemetry/trace**: giới hạn điểm vẽ, simplify polyline, cache kết quả trace-route phổ biến.
- **Danh sách Ports/Parties**: search + pagination server-side khi dữ liệu lớn.

### 5) UX/data quality còn thiếu

- **Chuẩn hóa type dữ liệu**: nhiều nơi dùng `Record<string, unknown>` → nên có schema/types rõ cho shipment detail/custody chain.
- **Empty state & lỗi**: đã có cảnh báo cơ bản; nên bổ sung hướng dẫn hành động (CTA) theo từng lỗi (401/403/404/409).
- **Route optimization**: thêm filter `maxTransitStops`, `maxAlarmRate`, `routeType`, `maxRoutes` đúng như mô tả trong `README.md`.

## “Quick wins” (nên làm sớm)

- Thêm route/menu cho `TrackingMapPage` (nếu đây là tính năng mong muốn).
- Thêm filter nâng cao cho `RouteOptimizationPage` (constraints) và hiển thị route trên map.
- Bổ sung actions cho alarms (ack/close) và hiển thị “alarm aging”.

