-- ============================================================================
-- OUTBOX PATTERN: Bảng outbox_events
-- ============================================================================
-- Mục đích:
--   Lưu trữ các event (alarm, violation, ...) cần được gửi thông báo ra ngoài.
--   Bảng này được INSERT cùng transaction với UPDATE Shipments để đảm bảo
--   tính nhất quán (consistency): nếu DB ghi thành công thì CHẮC CHẮN
--   notification sẽ được gửi, dù server có restart giữa chừng.
--
-- Luồng hoạt động:
--   1. Saga Orchestrator phát hiện vi phạm nhiệt độ
--   2. Trong CÙNG 1 transaction:
--      a. UPDATE Shipments SET LastTelemetryStatus = 'VIOLATION'
--      b. INSERT INTO outbox_events (payload, ...)
--   3. Background Outbox Processor định kỳ quét bảng này
--   4. Gửi notification (email/webhook) đến các bên liên quan
--   5. Mark event là PROCESSED
--
-- Database: supply_chain_sql (MySQL)
-- ============================================================================

USE supply_chain_sql;

-- Xóa bảng cũ nếu tồn tại (dùng khi re-run migration)
DROP TABLE IF EXISTS outbox_events;

CREATE TABLE outbox_events (
    -- Auto-increment primary key
    id              BIGINT          NOT NULL AUTO_INCREMENT,

    -- Loại event: ALARM_TRIGGERED | VIOLATION_DETECTED | CUSTODY_BLOCKED | SYSTEM_ALERT
    event_type      VARCHAR(64)     NOT NULL,

    -- Dữ liệu của event dưới dạng JSON (linh hoạt, không cần thêm cột khi thêm loại event)
    -- Ví dụ: { "shipment_id": "SHP-001", "temp": 35.2, "tempMax": 25.0, ... }
    payload         JSON            NOT NULL,

    -- Trạng thái xử lý:
    --   PENDING    = chưa xử lý (mới INSERT)
    --   PROCESSING = đang được xử lý (tránh duplicate send)
    --   PROCESSED  = đã gửi notification thành công
    --   FAILED     = thất bại sau MAX_RETRY lần thử
    status          ENUM('PENDING','PROCESSING','PROCESSED','FAILED')
                    NOT NULL DEFAULT 'PENDING',

    -- Số lần đã thử gửi (dùng để retry logic)
    retry_count     INT             NOT NULL DEFAULT 0,

    -- Lỗi cuối cùng (nếu có) - giúp debug khi status = FAILED
    last_error      TEXT            NULL,

    -- Timestamp khi event được tạo (cùng lúc với UPDATE Shipments)
    created_at      TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    -- Timestamp khi event được xử lý thành công
    processed_at    TIMESTAMP(6)    NULL,

    -- Cho phép đặt lịch gửi notification vào tương lai (nếu cần)
    -- NULL = xử lý ngay lập tức
    scheduled_at    TIMESTAMP(6)    NULL,

    PRIMARY KEY (id),

    -- Index để Outbox Processor query nhanh các event PENDING theo thời gian tạo
    INDEX idx_outbox_status_created  (status, created_at),

    -- Index để query theo loại event
    INDEX idx_outbox_event_type      (event_type, status),

    -- Index để tìm các event liên quan đến một shipment cụ thể
    -- Dùng JSON function để tạo index trên trường trong JSON payload
    INDEX idx_outbox_shipment_id     ((CAST(payload->>'$.shipment_id' AS CHAR(32)) COLLATE utf8mb4_bin))

) ENGINE=InnoDB
  COMMENT='Outbox Pattern - đảm bảo at-least-once delivery cho notifications';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1) Bảng này KHÔNG được truy cập trực tiếp từ API.
--    Chỉ có Saga Orchestrator (INSERT) và Outbox Processor (UPDATE/SELECT).
--
-- 2) Status flow:
--    PENDING → PROCESSING → PROCESSED (happy path)
--    PENDING → PROCESSING → PENDING   (retry sau khi thất bại)
--    PENDING → PROCESSING → FAILED    (sau MAX_RETRY lần)
--
-- 3) PROCESSING status tránh 2 worker cùng gửi 1 notification (at-most-once).
--    Kết hợp với retry → đảm bảo at-least-once delivery.
-- ============================================================================
