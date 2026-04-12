# Real-time telemetry & alarms (frontend)

## Khuyến nghị

- **WebSocket** hoặc **Server-Sent Events (SSE)** từ backend khi có vi phạm nhiệt độ / alarm mới, để UI cập nhật không cần polling dày.
- Tránh refetch toàn bộ chuỗi telemetry mỗi vài giây; ưu tiên incremental append hoặc window query theo thời gian.

## Hiện trạng (MVP)

- Dùng **TanStack Query** với `staleTime`, `refetchOnWindowFocus`, và chuông cảnh báo header **refetch 60s** (`GET /api/v1/alarms`).
- Biểu đồ telemetry dùng **Recharts** với `isAnimationActive={data.length < 500}` để giảm tải khi nhiều điểm.

## Khi tăng quy mô

- Cân nhắc **Apache ECharts** với `setOption` incremental / downsampling cho chuỗi IoT rất dài.
