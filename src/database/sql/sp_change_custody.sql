-- ============================================================================
-- STORED PROCEDURE: sp_change_custody
-- ============================================================================
-- Description: Xử lý Transaction nguyên tử cho việc bàn giao quyền sở hữu (Chain of Custody).
--              Đảm bảo tính minh bạch pháp lý khi chuyển trách nhiệm giữa các bên.
--
-- Luồng (từ đặc tả):
--   1. Kiểm tra bên chuyển giao có đúng là chủ sở hữu hiện tại không
--   2. Kiểm tra lô hàng không bị khóa (ALARM)
--   3. Kết thúc quyền sở hữu của bên cũ (EndAtUTC)
--   4. Tạo bản ghi sở hữu mới cho bên nhận
--   5. Cập nhật CurrentPortCode của lô hàng
--
-- Database: supply_chain_sql (MySQL)
-- Created: 2026-02-28
-- ============================================================================

USE supply_chain_sql;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_change_custody$$

CREATE PROCEDURE sp_change_custody(
    IN  p_shipment_id        VARCHAR(32),
    IN  p_from_party_id      VARCHAR(32),   -- Bên chuyển giao (chủ sở hữu hiện tại)
    IN  p_to_party_id        VARCHAR(32),   -- Bên nhận quyền sở hữu
    IN  p_handover_port_code VARCHAR(16),   -- Cảng bàn giao
    IN  p_handover_condition VARCHAR(16),  -- GOOD | DAMAGED | PARTIAL
    IN  p_handover_notes     TEXT,         -- Ghi chú (optional)
    IN  p_handover_signature VARCHAR(255), -- Hash chữ ký số (optional)
    IN  p_witness_party_id   VARCHAR(32),  -- Bên chứng kiến (optional)
    OUT p_success            TINYINT(1),   -- 1 = thành công, 0 = thất bại
    OUT p_message            VARCHAR(255)  -- Thông báo lỗi hoặc trạng thái
)
BEGIN
    DECLARE v_current_ownership_id CHAR(36);
    DECLARE v_shipment_status      VARCHAR(16);
    DECLARE v_current_owner_id     VARCHAR(32);

    -- Khởi tạo
    SET p_success = 0;
    SET p_message = NULL;

    -- Validate input cơ bản
    IF p_shipment_id IS NULL OR TRIM(p_shipment_id) = '' THEN
        SET p_message = 'ShipmentID is required';
    ELSEIF p_from_party_id IS NULL OR TRIM(p_from_party_id) = '' THEN
        SET p_message = 'FromPartyID (current owner) is required';
    ELSEIF p_to_party_id IS NULL OR TRIM(p_to_party_id) = '' THEN
        SET p_message = 'ToPartyID (new owner) is required';
    ELSEIF p_handover_port_code IS NULL OR TRIM(p_handover_port_code) = '' THEN
        SET p_message = 'HandoverPortCode is required';
    ELSE
        -- Default handover condition nếu NULL, validate ENUM
        IF p_handover_condition IS NULL OR TRIM(p_handover_condition) = '' THEN
            SET p_handover_condition = 'GOOD';
        ELSEIF p_handover_condition NOT IN ('GOOD','DAMAGED','PARTIAL') THEN
            SET p_message = 'HandoverCondition must be GOOD, DAMAGED, or PARTIAL';
        END IF;

        -- Kiểm tra trước khi bắt đầu transaction (chỉ khi chưa có lỗi validation)
        IF p_message IS NULL THEN
        SELECT s.Status
          INTO v_shipment_status
          FROM Shipments s
         WHERE s.ShipmentID = p_shipment_id;

        IF v_shipment_status IS NULL THEN
            SET p_message = 'Shipment not found';
        ELSEIF v_shipment_status = 'ALARM' THEN
            SET p_message = 'Shipment is in ALARM status - custody transfer blocked until resolved';
        ELSE
            -- Lấy ownership đang active (EndAtUTC IS NULL)
            SELECT o.OwnershipID, o.PartyID
              INTO v_current_ownership_id, v_current_owner_id
              FROM Ownership o
             WHERE o.ShipmentID = p_shipment_id
               AND o.EndAtUTC IS NULL
             LIMIT 1;

            IF v_current_ownership_id IS NULL THEN
                SET p_message = 'No active ownership found for this shipment';
            ELSEIF v_current_owner_id != p_from_party_id THEN
                SET p_message = 'FromPartyID is not the current owner - transfer not authorized';
            ELSE
                -- Tất cả kiểm tra pass -> thực thi transaction nguyên tử
                START TRANSACTION;

                -- 1) Kết thúc quyền sở hữu của bên cũ
                UPDATE Ownership
                   SET EndAtUTC         = CURRENT_TIMESTAMP(6),
                       HandoverPortCode = p_handover_port_code,
                       HandoverCondition = p_handover_condition,
                       HandoverNotes    = p_handover_notes,
                       HandoverSignature = p_handover_signature,
                       WitnessPartyID   = p_witness_party_id
                 WHERE OwnershipID = v_current_ownership_id;

                IF ROW_COUNT() != 1 THEN
                    SET p_message = 'Failed to close current ownership';
                    ROLLBACK;
                ELSE
                    -- 2) Tạo bản ghi sở hữu mới cho bên nhận
                    INSERT INTO Ownership (
                        OwnershipID,
                        ShipmentID,
                        PartyID,
                        StartAtUTC,
                        EndAtUTC,
                        HandoverPortCode,
                        HandoverCondition,
                        HandoverNotes,
                        HandoverSignature,
                        WitnessPartyID
                    ) VALUES (
                        UUID(),
                        p_shipment_id,
                        p_to_party_id,
                        CURRENT_TIMESTAMP(6),
                        NULL,
                        p_handover_port_code,
                        p_handover_condition,
                        p_handover_notes,
                        p_handover_signature,
                        p_witness_party_id
                    );

                    IF ROW_COUNT() != 1 THEN
                        SET p_message = 'Failed to create new ownership record';
                        ROLLBACK;
                    ELSE
                        -- 3) Cập nhật CurrentPortCode và CurrentLocation của Shipment
                        UPDATE Shipments
                           SET CurrentPortCode = p_handover_port_code,
                               CurrentLocation = (SELECT Name FROM Ports WHERE PortCode = p_handover_port_code LIMIT 1),
                               UpdatedAtUTC    = CURRENT_TIMESTAMP(6)
                         WHERE ShipmentID = p_shipment_id;

                        IF ROW_COUNT() != 1 THEN
                            SET p_message = 'Failed to update shipment location';
                            ROLLBACK;
                        ELSE
                            COMMIT;
                            SET p_success = 1;
                            SET p_message = 'Custody transfer completed successfully';
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;
        END IF;  -- p_message IS NULL
    END IF;
END$$

DELIMITER ;

-- ============================================================================
-- USAGE EXAMPLE
-- ============================================================================
-- CALL sp_change_custody(
--     'SHP-2024-001234',      -- p_shipment_id
--     'PARTY-LOG-001',        -- p_from_party_id (current owner)
--     'PARTY-LOG-002',        -- p_to_party_id (new owner)
--     'VNSGN',                -- p_handover_port_code
--     'GOOD',                 -- p_handover_condition
--     NULL,                   -- p_handover_notes
--     NULL,                   -- p_handover_signature
--     NULL,                   -- p_witness_party_id
--     @success,
--     @message
-- );
-- SELECT @success AS success, @message AS message;
-- ============================================================================
