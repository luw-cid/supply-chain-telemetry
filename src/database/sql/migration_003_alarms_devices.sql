-- ============================================================================
-- MIGRATION 003: Alarms lifecycle + Device management
-- ============================================================================
-- 1. Add AssignedTo / AssignedAtUTC to AlarmEvents
-- 2. Create Devices table for IoT device management
-- 3. Create new stored procedures for alarm operations
-- ============================================================================

USE supply_chain_sql;

-- ============================================================================
-- 1. ALARMEVENTS: Add AssignedTo column
-- ============================================================================
ALTER TABLE AlarmEvents
  ADD COLUMN AssignedTo VARCHAR(32) NULL AFTER AcknowledgedAtUTC,
  ADD COLUMN AssignedAtUTC TIMESTAMP(6) NULL AFTER AssignedTo,
  ADD INDEX idx_alarm_assigned (AssignedTo, Status);

-- ============================================================================
-- 2. DEVICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS Devices (
    DeviceID      VARCHAR(64)   NOT NULL,
    DeviceName    VARCHAR(255)  NULL,
    DeviceType    VARCHAR(32)   NOT NULL DEFAULT 'IOT_SENSOR',
    Status        ENUM('ACTIVE','INACTIVE','MAINTENANCE','RETIRED') NOT NULL DEFAULT 'ACTIVE',
    FirmwareVer   VARCHAR(32)   NULL,
    LastPingAtUTC TIMESTAMP(6)  NULL,
    Metadata      JSON          NULL,
    AssignedShipmentID VARCHAR(32) NULL,
    CreatedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (DeviceID),
    INDEX idx_device_status (Status),
    INDEX idx_device_shipment (AssignedShipmentID),
    INDEX idx_device_lastping (LastPingAtUTC),

    CONSTRAINT fk_device_shipment
        FOREIGN KEY (AssignedShipmentID) REFERENCES Shipments(ShipmentID)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='IoT device registry for telemetry tracking';

-- ============================================================================
-- 3. STORED PROCEDURE: sp_resolve_alarm
-- ============================================================================
-- Giải quyết alarm: cập nhật trạng thái alarm + clear shipment alarm fields
-- ============================================================================
DROP PROCEDURE IF EXISTS sp_resolve_alarm;

DELIMITER $$

CREATE PROCEDURE sp_resolve_alarm(
    IN p_alarm_event_id CHAR(36),
    IN p_resolved_by    VARCHAR(32),
    IN p_resolution     VARCHAR(255),
    IN p_new_status     VARCHAR(32)  -- 'RESOLVED' or 'FALSE_ALARM'
)
BEGIN
    DECLARE v_shipment_id VARCHAR(32);

    START TRANSACTION;

    -- Lấy ShipmentID từ alarm
    SELECT ShipmentID INTO v_shipment_id
    FROM AlarmEvents
    WHERE AlarmEventID = p_alarm_event_id
    FOR UPDATE;

    IF v_shipment_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'sp_resolve_alarm: Alarm event not found';
    END IF;

    -- Update alarm event
    UPDATE AlarmEvents
    SET Status          = p_new_status,
        ResolvedBy      = p_resolved_by,
        ResolvedAtUTC   = CURRENT_TIMESTAMP(6),
        AlarmReason     = CONCAT(AlarmReason, ' | Resolved: ', p_resolution)
    WHERE AlarmEventID = p_alarm_event_id;

    -- Clear shipment alarm fields
    UPDATE Shipments
    SET Status              = 'NORMAL',
        LastTelemetryStatus = 'OK',
        AlarmAtUTC          = NULL,
        AlarmReason         = NULL
    WHERE ShipmentID = v_shipment_id;

    COMMIT;
END$$

DELIMITER ;
