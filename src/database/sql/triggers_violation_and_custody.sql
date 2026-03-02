-- ============================================================================
-- SQL TRIGGERS: TRG_CHECK_VIOLATION & TRG_BLOCK_CUSTODY_WHEN_ALARM
-- ============================================================================
-- Description:
--   - TRG_CHECK_VIOLATION:
--       Khi LastTelemetryStatus chuyển sang 'VIOLATION' thì tự động
--       đưa Shipment vào trạng thái ALARM và ghi lại AlarmAtUTC / AlarmReason.
--   - TRG_BLOCK_CUSTODY_WHEN_ALARM:
--       Chặn mọi INSERT Ownership mới (custody transfer) nếu Shipment
--       đang ở trạng thái ALARM.
--
-- Database: supply_chain_sql (MySQL)
-- ============================================================================

USE supply_chain_sql;

DELIMITER $$

-- ============================================================================
-- TRIGGER 1: TRG_CHECK_VIOLATION
--   - Bắn khi Shipment được UPDATE
--   - Nếu LastTelemetryStatus = 'VIOLATION' và trước đó không phải 'VIOLATION'
--     thì:
--       + NEW.Status       = 'ALARM'
--       + NEW.AlarmAtUTC   = CURRENT_TIMESTAMP(6) (nếu chưa có)
--       + NEW.AlarmReason  = message mặc định nếu đang NULL/rỗng
-- ============================================================================

DROP TRIGGER IF EXISTS TRG_CHECK_VIOLATION$$

CREATE TRIGGER TRG_CHECK_VIOLATION
BEFORE UPDATE ON Shipments
FOR EACH ROW
BEGIN
    -- Chỉ xử lý khi LastTelemetryStatus chuyển sang VIOLATION
    IF NEW.LastTelemetryStatus = 'VIOLATION'
       AND (OLD.LastTelemetryStatus IS NULL
            OR OLD.LastTelemetryStatus <> 'VIOLATION') THEN

        -- Đưa shipment vào trạng thái ALARM
        SET NEW.Status = 'ALARM';

        -- Ghi thời điểm kích hoạt alarm nếu chưa có
        IF NEW.AlarmAtUTC IS NULL THEN
            SET NEW.AlarmAtUTC = CURRENT_TIMESTAMP(6);
        END IF;

        -- Nếu chưa có lý do alarm thì set default
        IF NEW.AlarmReason IS NULL OR NEW.AlarmReason = '' THEN
            SET NEW.AlarmReason = 'Telemetry violation detected by TRG_CHECK_VIOLATION';
        END IF;
    END IF;
END$$


-- ============================================================================
-- TRIGGER 2: TRG_BLOCK_CUSTODY_WHEN_ALARM
--   - Bắn BEFORE INSERT trên Ownership
--   - Nếu Shipment tương ứng đang ở trạng thái ALARM thì raise error
--     để chặn custody transfer (bàn giao quyền sở hữu).
-- ============================================================================

DROP TRIGGER IF EXISTS TRG_BLOCK_CUSTODY_WHEN_ALARM$$

CREATE TRIGGER TRG_BLOCK_CUSTODY_WHEN_ALARM
BEFORE INSERT ON Ownership
FOR EACH ROW
BEGIN
    DECLARE v_shipment_status VARCHAR(16);

    -- Lấy trạng thái hiện tại của shipment
    SELECT Status
      INTO v_shipment_status
      FROM Shipments
     WHERE ShipmentID = NEW.ShipmentID;

    -- Nếu shipment không tồn tại => lỗi dữ liệu
    IF v_shipment_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'TRG_BLOCK_CUSTODY_WHEN_ALARM: Shipment not found for new ownership record';
    -- Nếu shipment đang ALARM => chặn transfer
    ELSEIF v_shipment_status = 'ALARM' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'TRG_BLOCK_CUSTODY_WHEN_ALARM: Custody transfer blocked because shipment is in ALARM status';
    END IF;
END$$

DELIMITER ;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1) TRG_CHECK_VIOLATION giả định rằng application layer (Saga Orchestrator)
--    sẽ update LastTelemetryStatus sang 'VIOLATION' khi phát hiện vi phạm
--    từ MongoDB telemetry stream.
--
-- 2) TRG_BLOCK_CUSTODY_WHEN_ALARM bảo vệ dữ liệu ở mức SQL, kể cả khi
--    có ai đó cố gắng INSERT trực tiếp vào Ownership mà bỏ qua stored
--    procedure sp_change_custody.
-- ============================================================================

