/*
 Navicat Premium Dump SQL

 Source Server         : LocalDB
 Source Server Type    : MySQL
 Source Server Version : 100432 (10.4.32-MariaDB)
 Source Host           : localhost:3306
 Source Schema         : supply_chain_sql

 Target Server Type    : MySQL
 Target Server Version : 100432 (10.4.32-MariaDB)
 File Encoding         : 65001

 Date: 04/05/2026 23:39:53
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for alarmevents
-- ----------------------------
DROP TABLE IF EXISTS `alarmevents`;
CREATE TABLE `alarmevents`  (
  `AlarmEventID` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ShipmentID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `AlarmType` enum('TEMP_VIOLATION','CHECKIN_TIMEOUT','MANUAL','HUMIDITY_VIOLATION','ROUTE_DEVIATION','UNAUTHORIZED_ACCESS','DEVICE_MALFUNCTION') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Severity` enum('LOW','MEDIUM','HIGH','CRITICAL') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'MEDIUM',
  `Status` enum('OPEN','ACKNOWLEDGED','RESOLVED','FALSE_ALARM') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'OPEN',
  `AlarmReason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `AlarmAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `Source` enum('SQL_TRIGGER','BATCH_SCAN','INTEGRATION') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `AcknowledgedBy` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `AcknowledgedAtUTC` timestamp(6) NULL DEFAULT NULL,
  `AssignedTo` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `AssignedAtUTC` timestamp(6) NULL DEFAULT NULL,
  `ResolvedBy` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `ResolvedAtUTC` timestamp(6) NULL DEFAULT NULL,
  `CreatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  PRIMARY KEY (`AlarmEventID`) USING BTREE,
  INDEX `idx_alarm_shipment_at`(`ShipmentID` ASC, `AlarmAtUTC` ASC) USING BTREE,
  INDEX `idx_alarm_type_at`(`AlarmType` ASC, `AlarmAtUTC` ASC) USING BTREE,
  INDEX `idx_alarm_status_severity`(`Status` ASC, `Severity` ASC) USING BTREE,
  INDEX `idx_alarm_acknowledged`(`AcknowledgedBy` ASC, `AcknowledgedAtUTC` ASC) USING BTREE,
  INDEX `idx_alarm_unresolved`(`Status` ASC, `AlarmAtUTC` ASC) USING BTREE,
  INDEX `idx_alarm_assigned`(`AssignedTo` ASC, `Status` ASC) USING BTREE,
  CONSTRAINT `fk_alarm_shipment` FOREIGN KEY (`ShipmentID`) REFERENCES `shipments` (`ShipmentID`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Stores alarm events for shipments' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for auditlog
-- ----------------------------
DROP TABLE IF EXISTS `auditlog`;
CREATE TABLE `auditlog`  (
  `AuditID` bigint NOT NULL AUTO_INCREMENT,
  `TableName` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Operation` enum('INSERT','UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `RecordID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `OldValue` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `NewValue` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ChangedBy` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ChangedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `ClientIP` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `UserAgent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`AuditID`, `ChangedAtUTC`) USING BTREE,
  INDEX `idx_audit_table_time`(`TableName` ASC, `ChangedAtUTC` ASC) USING BTREE,
  INDEX `idx_audit_user`(`ChangedBy` ASC, `ChangedAtUTC` ASC) USING BTREE,
  INDEX `idx_audit_record`(`TableName` ASC, `RecordID` ASC) USING BTREE,
  INDEX `idx_audit_operation`(`Operation` ASC, `ChangedAtUTC` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 17 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Audit log table for compliance tracking' ROW_FORMAT = Dynamic PARTITION BY RANGE (unix_timestamp(`ChangedAtUTC`))
PARTITIONS 10
(PARTITION `p_2024_q1` VALUES LESS THAN (1711904400) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2024_q2` VALUES LESS THAN (1719766800) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2024_q3` VALUES LESS THAN (1727715600) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2024_q4` VALUES LESS THAN (1735664400) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2025_q1` VALUES LESS THAN (1743440400) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2025_q2` VALUES LESS THAN (1751302800) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2025_q3` VALUES LESS THAN (1759251600) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2025_q4` VALUES LESS THAN (1767200400) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_2026_q1` VALUES LESS THAN (1774976400) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 ,
PARTITION `p_future` VALUES LESS THAN (MAXVALUE) ENGINE = InnoDB MAX_ROWS = 0 MIN_ROWS = 0 )
;

-- ----------------------------
-- Table structure for cargoprofiles
-- ----------------------------
DROP TABLE IF EXISTS `cargoprofiles`;
CREATE TABLE `cargoprofiles`  (
  `CargoProfileID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `CargoType` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `CargoName` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `TempMin` decimal(6, 2) NOT NULL,
  `TempMax` decimal(6, 2) NOT NULL,
  `HumidityMin` decimal(5, 2) NULL DEFAULT NULL,
  `HumidityMax` decimal(5, 2) NULL DEFAULT NULL,
  `MaxTransitHours` int NULL DEFAULT NULL,
  `HandlingInstructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  PRIMARY KEY (`CargoProfileID`) USING BTREE,
  CONSTRAINT `chk_cargo_temp` CHECK (`TempMin` < `TempMax`),
  CONSTRAINT `chk_cargo_humidity` CHECK (`HumidityMin` is null or `HumidityMax` is null or `HumidityMin` < `HumidityMax`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Defines transport conditions for cargo types' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for devices
-- ----------------------------
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices`  (
  `DeviceID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `DeviceName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `DeviceType` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'IOT_SENSOR',
  `Status` enum('ACTIVE','INACTIVE','MAINTENANCE','RETIRED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ACTIVE',
  `FirmwareVer` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `LastPingAtUTC` timestamp(6) NULL DEFAULT NULL,
  `Metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `AssignedShipmentID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `CreatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `UpdatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`DeviceID`) USING BTREE,
  INDEX `idx_device_status`(`Status` ASC) USING BTREE,
  INDEX `idx_device_shipment`(`AssignedShipmentID` ASC) USING BTREE,
  INDEX `idx_device_lastping`(`LastPingAtUTC` ASC) USING BTREE,
  CONSTRAINT `fk_device_shipment` FOREIGN KEY (`AssignedShipmentID`) REFERENCES `shipments` (`ShipmentID`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'IoT device registry' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for outbox_events
-- ----------------------------
DROP TABLE IF EXISTS `outbox_events`;
CREATE TABLE `outbox_events`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `event_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `status` enum('PENDING','PROCESSING','PROCESSED','FAILED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'PENDING',
  `retry_count` int NOT NULL DEFAULT 0,
  `last_error` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `created_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `processed_at` timestamp(6) NULL DEFAULT NULL,
  `scheduled_at` timestamp(6) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_outbox_status_created`(`status` ASC, `created_at` ASC) USING BTREE,
  INDEX `idx_outbox_event_type`(`event_type` ASC, `status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Outbox Pattern for at-least-once delivery' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for ownership
-- ----------------------------
DROP TABLE IF EXISTS `ownership`;
CREATE TABLE `ownership`  (
  `OwnershipID` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ShipmentID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `PartyID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `StartAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `EndAtUTC` timestamp(6) NULL DEFAULT NULL,
  `HandoverPortCode` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `HandoverCondition` enum('GOOD','DAMAGED','PARTIAL') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'GOOD',
  `HandoverNotes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `HandoverSignature` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `WitnessPartyID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `ActiveShipmentID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci GENERATED ALWAYS AS (case when `EndAtUTC` is null then `ShipmentID` else NULL end) STORED NULL,
  PRIMARY KEY (`OwnershipID`) USING BTREE,
  UNIQUE INDEX `uq_ownership_active`(`ActiveShipmentID` ASC) USING BTREE,
  INDEX `fk_ownership_port`(`HandoverPortCode` ASC) USING BTREE,
  INDEX `fk_ownership_witness`(`WitnessPartyID` ASC) USING BTREE,
  INDEX `idx_ownership_shipment_end`(`ShipmentID` ASC, `EndAtUTC` ASC) USING BTREE,
  INDEX `idx_ownership_party_start`(`PartyID` ASC, `StartAtUTC` ASC) USING BTREE,
  INDEX `idx_ownership_condition`(`HandoverCondition` ASC) USING BTREE,
  CONSTRAINT `fk_ownership_party` FOREIGN KEY (`PartyID`) REFERENCES `parties` (`PartyID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_ownership_port` FOREIGN KEY (`HandoverPortCode`) REFERENCES `ports` (`PortCode`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_ownership_shipment` FOREIGN KEY (`ShipmentID`) REFERENCES `shipments` (`ShipmentID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_ownership_witness` FOREIGN KEY (`WitnessPartyID`) REFERENCES `parties` (`PartyID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_ownership_dates` CHECK (`EndAtUTC` is null or `EndAtUTC` >= `StartAtUTC`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Tracks chain of custody for shipments' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for parties
-- ----------------------------
DROP TABLE IF EXISTS `parties`;
CREATE TABLE `parties`  (
  `PartyID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `PartyType` enum('OWNER','LOGISTICS','AUDITOR') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `Phone` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `Address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `Status` enum('ACTIVE','INACTIVE','SUSPENDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ACTIVE',
  `CreatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `UpdatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`PartyID`) USING BTREE,
  INDEX `idx_party_type_status`(`PartyType` ASC, `Status` ASC) USING BTREE,
  INDEX `idx_party_email`(`Email` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Stores information about all parties in supply chain' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for ports
-- ----------------------------
DROP TABLE IF EXISTS `ports`;
CREATE TABLE `ports`  (
  `PortCode` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Country` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Latitude` decimal(10, 8) NULL DEFAULT NULL,
  `Longitude` decimal(11, 8) NULL DEFAULT NULL,
  `Timezone` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `Status` enum('OPERATIONAL','CLOSED','RESTRICTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'OPERATIONAL',
  PRIMARY KEY (`PortCode`) USING BTREE,
  INDEX `idx_port_country`(`Country` ASC) USING BTREE,
  INDEX `idx_port_location`(`Latitude` ASC, `Longitude` ASC) USING BTREE,
  INDEX `idx_port_status`(`Status` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Stores port information with geolocation data' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for shipments
-- ----------------------------
DROP TABLE IF EXISTS `shipments`;
CREATE TABLE `shipments`  (
  `ShipmentID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `CargoProfileID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `WeightKg` decimal(10, 2) NOT NULL,
  `VolumeM3` decimal(10, 2) NULL DEFAULT NULL,
  `ShipperPartyID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ConsigneePartyID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `OriginPortCode` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `DestinationPortCode` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Status` enum('NORMAL','IN_TRANSIT','ALARM','COMPLETED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `CurrentLocation` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `CurrentPortCode` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `TrackingDeviceID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `CreatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `UpdatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `LastTelemetryAtUTC` timestamp(6) NULL DEFAULT NULL,
  `LastTelemetryStatus` enum('OK','VIOLATION','UNKNOWN') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'UNKNOWN',
  `LastCheckInAtUTC` timestamp(6) NULL DEFAULT NULL,
  `AlarmAtUTC` timestamp(6) NULL DEFAULT NULL,
  `AlarmReason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  PRIMARY KEY (`ShipmentID`) USING BTREE,
  INDEX `fk_shipment_shipper`(`ShipperPartyID` ASC) USING BTREE,
  INDEX `fk_shipment_consignee`(`ConsigneePartyID` ASC) USING BTREE,
  INDEX `fk_shipment_destination`(`DestinationPortCode` ASC) USING BTREE,
  INDEX `fk_shipment_current_port`(`CurrentPortCode` ASC) USING BTREE,
  INDEX `idx_shipment_status_updated`(`Status` ASC, `UpdatedAtUTC` ASC) USING BTREE,
  INDEX `idx_shipment_origin_dest`(`OriginPortCode` ASC, `DestinationPortCode` ASC) USING BTREE,
  INDEX `idx_shipment_last_checkin`(`LastCheckInAtUTC` ASC) USING BTREE,
  INDEX `idx_shipment_tracking_device`(`TrackingDeviceID` ASC) USING BTREE,
  INDEX `idx_shipment_cargo_status`(`CargoProfileID` ASC, `Status` ASC) USING BTREE,
  CONSTRAINT `fk_shipment_cargo` FOREIGN KEY (`CargoProfileID`) REFERENCES `cargoprofiles` (`CargoProfileID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shipment_consignee` FOREIGN KEY (`ConsigneePartyID`) REFERENCES `parties` (`PartyID`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shipment_current_port` FOREIGN KEY (`CurrentPortCode`) REFERENCES `ports` (`PortCode`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shipment_destination` FOREIGN KEY (`DestinationPortCode`) REFERENCES `ports` (`PortCode`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shipment_origin` FOREIGN KEY (`OriginPortCode`) REFERENCES `ports` (`PortCode`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shipment_shipper` FOREIGN KEY (`ShipperPartyID`) REFERENCES `parties` (`PartyID`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Central table storing shipment information' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `UserID` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Phone` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `PasswordHash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `Role` enum('ADMIN','OWNER','LOGISTICS','AUDITOR') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'OWNER',
  `PartyID` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `Status` enum('ACTIVE','INACTIVE','SUSPENDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ACTIVE',
  `CreatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `UpdatedAtUTC` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`UserID`) USING BTREE,
  UNIQUE INDEX `uq_users_email`(`Email` ASC) USING BTREE,
  INDEX `idx_users_party`(`PartyID` ASC) USING BTREE,
  INDEX `idx_users_role_status`(`Role` ASC, `Status` ASC) USING BTREE,
  CONSTRAINT `fk_users_party` FOREIGN KEY (`PartyID`) REFERENCES `parties` (`PartyID`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Stores user accounts for the supply chain application' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Procedure structure for sp_change_custody
-- ----------------------------
DROP PROCEDURE IF EXISTS `sp_change_custody`;
delimiter ;;
CREATE PROCEDURE `sp_change_custody`(IN  p_shipment_id        VARCHAR(32),
    IN  p_from_party_id      VARCHAR(32),   -- Bên chuyển giao (chủ sở hữu hiện tại)
    IN  p_to_party_id        VARCHAR(32),   -- Bên nhận quyền sở hữu
    IN  p_handover_port_code VARCHAR(16),   -- Cảng bàn giao
    IN  p_handover_condition VARCHAR(16),  -- GOOD | DAMAGED | PARTIAL
    IN  p_handover_notes     TEXT,         -- Ghi chú (optional)
    IN  p_handover_signature VARCHAR(255), -- Hash chữ ký số (optional)
    IN  p_witness_party_id   VARCHAR(32),  -- Bên chứng kiến (optional)
    OUT p_success            TINYINT(1),   -- 1 = thành công, 0 = thất bại
    OUT p_message            VARCHAR(255))
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
END
;;
delimiter ;

-- ----------------------------
-- Procedure structure for SP_TraceChainOfCustodyRecursive
-- ----------------------------
DROP PROCEDURE IF EXISTS `SP_TraceChainOfCustodyRecursive`;
delimiter ;;
CREATE PROCEDURE `SP_TraceChainOfCustodyRecursive`(IN p_ShipmentID VARCHAR(32),
    IN p_DetailLevel VARCHAR(16))
  READS SQL DATA 
BEGIN
    -- ========================================================================
    -- STEP 1: Validate Input
    -- ========================================================================
    IF p_ShipmentID IS NULL OR TRIM(p_ShipmentID) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ShipmentID is required';
    END IF;
    
    -- Default to DETAILED if not specified
    IF p_DetailLevel IS NULL THEN
        SET p_DetailLevel = 'DETAILED';
    END IF;
    
    IF p_DetailLevel NOT IN ('SUMMARY', 'DETAILED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DetailLevel must be SUMMARY or DETAILED';
    END IF;
    
    -- ========================================================================
    -- STEP 2: Check if shipment exists
    -- ========================================================================
    IF NOT EXISTS (SELECT 1 FROM Shipments WHERE ShipmentID = p_ShipmentID) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shipment not found';
    END IF;
    
    -- ========================================================================
    -- STEP 3: Main Query with Recursive CTE
    -- ========================================================================
    IF p_DetailLevel = 'SUMMARY' THEN
        -- SUMMARY Mode: Lightweight view of chain of custody
        WITH RECURSIVE cte_chain_of_custody AS (
            -- ================================================================
            -- ANCHOR MEMBER: First ownership record (earliest)
            -- ================================================================
            -- Tìm bản ghi ownership đầu tiên (sở hữu ban đầu)
            SELECT
                ROW_NUMBER() OVER (ORDER BY o.StartAtUTC ASC) AS step_number,
                o.OwnershipID,
                o.ShipmentID,
                o.PartyID AS CurrentOwnerPartyID,
                p_owner.Name AS CurrentOwnerName,
                CAST(NULL AS CHAR(32)) AS PreviousOwnerPartyID,
                CAST(NULL AS CHAR(255)) AS PreviousOwnerName,
                o.StartAtUTC,
                o.EndAtUTC,
                CASE
                    WHEN o.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS OwnershipStatus,
                o.HandoverPortCode,
                port.Name AS HandoverPortName,
                o.HandoverCondition,
                o.HandoverNotes,
                o.WitnessPartyID,
                witness.Name AS WitnessPartyName,
                1 AS chain_depth
            FROM
                Ownership o
            LEFT JOIN
                Parties p_owner ON o.PartyID = p_owner.PartyID
            LEFT JOIN
                Ports port ON o.HandoverPortCode = port.PortCode
            LEFT JOIN
                Parties witness ON o.WitnessPartyID = witness.PartyID
            WHERE
                o.ShipmentID = p_ShipmentID
                AND o.StartAtUTC = (
                    -- Get earliest ownership
                    SELECT MIN(StartAtUTC)
                    FROM Ownership
                    WHERE ShipmentID = p_ShipmentID
                )
            
            UNION ALL
            
            -- ================================================================
            -- RECURSIVE MEMBER: Next ownership records in chronological order
            -- ================================================================
            -- Tìm bản ghi ownership tiếp theo trong chuỗi
            SELECT
                cte.step_number + 1 AS step_number,
                o_next.OwnershipID,
                o_next.ShipmentID,
                p_next_owner.PartyID AS CurrentOwnerPartyID,
                p_next_owner.Name AS CurrentOwnerName,
                cte.CurrentOwnerPartyID AS PreviousOwnerPartyID,
                cte.CurrentOwnerName AS PreviousOwnerName,
                o_next.StartAtUTC,
                o_next.EndAtUTC,
                CASE
                    WHEN o_next.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS OwnershipStatus,
                o_next.HandoverPortCode,
                port_next.Name AS HandoverPortName,
                o_next.HandoverCondition,
                o_next.HandoverNotes,
                o_next.WitnessPartyID,
                witness_next.Name AS WitnessPartyName,
                cte.chain_depth + 1 AS chain_depth
            FROM
                cte_chain_of_custody cte
            INNER JOIN
                Ownership o_next ON cte.ShipmentID = o_next.ShipmentID
                    AND o_next.StartAtUTC > cte.StartAtUTC
                    AND o_next.StartAtUTC = (
                        -- Get next ownership chronologically
                        SELECT MIN(StartAtUTC)
                        FROM Ownership
                        WHERE ShipmentID = cte.ShipmentID
                            AND StartAtUTC > cte.StartAtUTC
                    )
            LEFT JOIN
                Parties p_next_owner ON o_next.PartyID = p_next_owner.PartyID
            LEFT JOIN
                Ports port_next ON o_next.HandoverPortCode = port_next.PortCode
            LEFT JOIN
                Parties witness_next ON o_next.WitnessPartyID = witness_next.PartyID
            WHERE
                cte.chain_depth < 100  -- Prevent infinite recursion
        )
        -- ====================================================================
        -- FINAL SELECT: Summary View
        -- ====================================================================
        SELECT
            p_ShipmentID AS ShipmentID,
            step_number AS TransferStep,
            CurrentOwnerName AS CurrentOwner,
            PreviousOwnerName AS PreviousOwner,
            OwnershipStatus,
            HandoverPortName AS HandoverPort,
            HandoverCondition,
            StartAtUTC,
            EndAtUTC,
            TIMEDIFF(
                COALESCE(EndAtUTC, CURRENT_TIMESTAMP(6)),
                StartAtUTC
            ) AS OwnershipDuration,
            chain_depth,
            (
                SELECT COUNT(*)
                FROM Ownership
                WHERE ShipmentID = p_ShipmentID
                    AND StartAtUTC <= (SELECT MAX(StartAtUTC) FROM cte_chain_of_custody)
            ) AS TotalTransfers
        FROM
            cte_chain_of_custody
        ORDER BY
            step_number ASC;
    
    ELSE -- DETAILED Mode
        -- DETAILED Mode: Complete view with all supporting information
        WITH RECURSIVE cte_chain_of_custody_detailed AS (
            -- ================================================================
            -- ANCHOR MEMBER: First ownership (detailed)
            -- ================================================================
            SELECT
                ROW_NUMBER() OVER (ORDER BY o.StartAtUTC ASC) AS step_number,
                o.OwnershipID,
                o.ShipmentID,
                1 AS chain_depth,
                o.PartyID AS current_owner_party_id,
                p_owner.Name AS current_owner_name,
                p_owner.PartyType AS current_owner_type,
                p_owner.Email AS current_owner_email,
                p_owner.Phone AS current_owner_phone,
                p_owner.Address AS current_owner_address,
                CAST(NULL AS CHAR(32)) AS previous_owner_party_id,
                CAST(NULL AS CHAR(255)) AS previous_owner_name,
                CAST(NULL AS CHAR(32)) AS previous_owner_type,
                o.StartAtUTC AS start_at_utc,
                o.EndAtUTC AS end_at_utc,
                CASE
                    WHEN o.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS ownership_status,
                o.HandoverPortCode,
                port.Name AS handover_port_name,
                port.Country AS handover_port_country,
                port.Latitude AS handover_port_latitude,
                port.Longitude AS handover_port_longitude,
                port.Timezone AS handover_port_timezone,
                o.HandoverCondition AS handover_condition,
                o.HandoverNotes AS handover_notes,
                o.HandoverSignature AS handover_signature,
                o.WitnessPartyID AS witness_party_id,
                witness.Name AS witness_party_name,
                witness.PartyType AS witness_party_type,
                CAST(CAST(o.StartAtUTC AS CHAR(26)) AS CHAR(1000)) AS transfer_sequence_path
            FROM
                Ownership o
            LEFT JOIN
                Parties p_owner ON o.PartyID = p_owner.PartyID
            LEFT JOIN
                Ports port ON o.HandoverPortCode = port.PortCode
            LEFT JOIN
                Parties witness ON o.WitnessPartyID = witness.PartyID
            WHERE
                o.ShipmentID = p_ShipmentID
                AND o.StartAtUTC = (
                    SELECT MIN(StartAtUTC)
                    FROM Ownership
                    WHERE ShipmentID = p_ShipmentID
                )
            
            UNION ALL
            
            -- ================================================================
            -- RECURSIVE MEMBER: Next ownership (detailed)
            -- ================================================================
            SELECT
                cte.step_number + 1 AS step_number,
                o_next.OwnershipID,
                o_next.ShipmentID,
                cte.chain_depth + 1 AS chain_depth,
                p_next_owner.PartyID AS current_owner_party_id,
                p_next_owner.Name AS current_owner_name,
                p_next_owner.PartyType AS current_owner_type,
                p_next_owner.Email AS current_owner_email,
                p_next_owner.Phone AS current_owner_phone,
                p_next_owner.Address AS current_owner_address,
                cte.current_owner_party_id AS previous_owner_party_id,
                cte.current_owner_name AS previous_owner_name,
                cte.current_owner_type AS previous_owner_type,
                o_next.StartAtUTC AS start_at_utc,
                o_next.EndAtUTC AS end_at_utc,
                CASE
                    WHEN o_next.EndAtUTC IS NULL THEN 'ACTIVE'
                    ELSE 'TRANSFERRED'
                END AS ownership_status,
                o_next.HandoverPortCode,
                port_next.Name AS handover_port_name,
                port_next.Country AS handover_port_country,
                port_next.Latitude AS handover_port_latitude,
                port_next.Longitude AS handover_port_longitude,
                port_next.Timezone AS handover_port_timezone,
                o_next.HandoverCondition AS handover_condition,
                o_next.HandoverNotes AS handover_notes,
                o_next.HandoverSignature AS handover_signature,
                o_next.WitnessPartyID AS witness_party_id,
                witness_next.Name AS witness_party_name,
                witness_next.PartyType AS witness_party_type,
                CAST(CONCAT(cte.transfer_sequence_path, ' -> ', CAST(o_next.StartAtUTC AS CHAR(26))) AS CHAR(1000)) AS transfer_sequence_path
            FROM
                cte_chain_of_custody_detailed cte
            INNER JOIN
                Ownership o_next ON cte.ShipmentID = o_next.ShipmentID
                    AND o_next.StartAtUTC > cte.start_at_utc
                    AND o_next.StartAtUTC = (
                        SELECT MIN(StartAtUTC)
                        FROM Ownership
                        WHERE ShipmentID = cte.ShipmentID
                            AND StartAtUTC > cte.start_at_utc
                    )
            LEFT JOIN
                Parties p_next_owner ON o_next.PartyID = p_next_owner.PartyID
            LEFT JOIN
                Ports port_next ON o_next.HandoverPortCode = port_next.PortCode
            LEFT JOIN
                Parties witness_next ON o_next.WitnessPartyID = witness_next.PartyID
            WHERE
                cte.chain_depth < 100
        )
        -- ====================================================================
        -- FINAL SELECT: Detailed View
        -- ====================================================================
        SELECT
            p_ShipmentID AS shipment_id,
            step_number,
            current_owner_party_id,
            previous_owner_party_id,
            current_owner_name,
            current_owner_type,
            current_owner_email,
            current_owner_phone,
            current_owner_address,
            previous_owner_name,
            previous_owner_type,
            HandoverPortCode,
            handover_port_name,
            handover_port_country,
            handover_port_latitude,
            handover_port_longitude,
            handover_port_timezone,
            handover_condition,
            handover_notes,
            handover_signature,
            witness_party_name,
            witness_party_type,
            start_at_utc,
            end_at_utc,
            TIMESTAMPDIFF(
                HOUR,
                start_at_utc,
                COALESCE(end_at_utc, CURRENT_TIMESTAMP(6))
            ) AS ownership_duration_hours,
            ownership_status,
            transfer_sequence_path,
            chain_depth,
            (
                SELECT COUNT(*)
                FROM Ownership
                WHERE ShipmentID = p_ShipmentID
            ) AS total_transfers_in_chain
        FROM
            cte_chain_of_custody_detailed
        ORDER BY
            step_number ASC;
    
    END IF;
    
END
;;
delimiter ;

-- ----------------------------
-- Procedure structure for SP_TraceRouteContext
-- ----------------------------
DROP PROCEDURE IF EXISTS `SP_TraceRouteContext`;
delimiter ;;
CREATE PROCEDURE `SP_TraceRouteContext`(IN p_ShipmentID VARCHAR(32))
BEGIN
    -- ========================================================================
    -- RESULT SET 1: Shipment Overview với Cargo Profile
    -- ========================================================================
    -- Mục đích: Cung cấp thông tin tổng quan và ngưỡng nhiệt độ
    -- Sử dụng: Frontend hiển thị header, backend validate violations
    -- 
    -- OPTIMIZATION:
    -- - STRAIGHT_JOIN để force optimal join order
    -- - LEFT JOIN cho optional relationships (ports, parties)
    -- - Covering index trên Shipments(ShipmentID)
    -- - Computed columns để giảm client-side processing
    -- 
    -- COST ANALYSIS:
    -- - Primary key lookup: O(1)
    -- - Foreign key joins: O(1) mỗi join
    -- - Total: O(1) constant time
    -- ========================================================================
    SELECT STRAIGHT_JOIN
        -- ====================================================================
        -- Shipment Basic Info
        -- ====================================================================
        s.ShipmentID,
        s.Status,
        s.WeightKg,
        s.VolumeM3,
        s.TrackingDeviceID,
        
        -- ====================================================================
        -- Cargo Profile - CRITICAL cho Violation Detection
        -- ====================================================================
        s.CargoProfileID,
        cp.CargoType,
        cp.CargoName,
        cp.TempMin,              -- Ngưỡng nhiệt độ tối thiểu
        cp.TempMax,              -- Ngưỡng nhiệt độ tối đa (dùng cho MongoDB)
        cp.HumidityMin,
        cp.HumidityMax,
        cp.MaxTransitHours,
        cp.HandlingInstructions,
        
        -- ====================================================================
        -- Route Information với Geolocation
        -- ====================================================================
        s.OriginPortCode,
        origin.Name AS OriginPortName,
        origin.Country AS OriginCountry,
        origin.Latitude AS OriginLatitude,
        origin.Longitude AS OriginLongitude,
        origin.Timezone AS OriginTimezone,
        
        s.DestinationPortCode,
        dest.Name AS DestinationPortName,
        dest.Country AS DestinationCountry,
        dest.Latitude AS DestinationLatitude,
        dest.Longitude AS DestinationLongitude,
        dest.Timezone AS DestinationTimezone,
        
        s.CurrentPortCode,
        current_port.Name AS CurrentPortName,
        current_port.Country AS CurrentCountry,
        
        -- ====================================================================
        -- Parties Information
        -- ====================================================================
        s.ShipperPartyID,
        shipper.Name AS ShipperName,
        shipper.Email AS ShipperEmail,
        shipper.Phone AS ShipperPhone,
        shipper.PartyType AS ShipperType,
        
        s.ConsigneePartyID,
        consignee.Name AS ConsigneeName,
        consignee.Email AS ConsigneeEmail,
        consignee.Phone AS ConsigneePhone,
        consignee.PartyType AS ConsigneeType,
        
        -- ====================================================================
        -- Telemetry Status
        -- ====================================================================
        s.LastTelemetryAtUTC,
        s.LastTelemetryStatus,
        s.LastCheckInAtUTC,
        
        -- ====================================================================
        -- Alarm Information
        -- ====================================================================
        s.AlarmAtUTC,
        s.AlarmReason,
        
        -- ====================================================================
        -- Timestamps
        -- ====================================================================
        s.CreatedAtUTC,
        s.UpdatedAtUTC,
        
        -- ====================================================================
        -- Computed Fields - Business Logic
        -- ====================================================================
        
        -- Transit duration (hours)
        TIMESTAMPDIFF(
            HOUR, 
            s.CreatedAtUTC, 
            COALESCE(s.UpdatedAtUTC, CURRENT_TIMESTAMP(6))
        ) AS TotalTransitHours,
        
        -- Transit duration (days) - for display
        ROUND(
            TIMESTAMPDIFF(
                HOUR, 
                s.CreatedAtUTC, 
                COALESCE(s.UpdatedAtUTC, CURRENT_TIMESTAMP(6))
            ) / 24.0, 
            1
        ) AS TotalTransitDays,
        
        -- Remaining transit time (hours)
        CASE 
            WHEN cp.MaxTransitHours IS NOT NULL THEN
                cp.MaxTransitHours - TIMESTAMPDIFF(
                    HOUR, 
                    s.CreatedAtUTC, 
                    CURRENT_TIMESTAMP(6)
                )
            ELSE NULL
        END AS RemainingTransitHours,
        
        -- Transit compliance status
        CASE 
            WHEN cp.MaxTransitHours IS NULL THEN 'NO_LIMIT'
            WHEN TIMESTAMPDIFF(HOUR, s.CreatedAtUTC, CURRENT_TIMESTAMP(6)) > cp.MaxTransitHours 
            THEN 'EXCEEDED'
            WHEN TIMESTAMPDIFF(HOUR, s.CreatedAtUTC, CURRENT_TIMESTAMP(6)) > cp.MaxTransitHours * 0.9 
            THEN 'WARNING'
            ELSE 'OK'
        END AS TransitComplianceStatus,
        
        -- Telemetry data freshness
        CASE 
            WHEN s.LastTelemetryAtUTC IS NULL THEN 'NO_DATA'
            WHEN TIMESTAMPDIFF(HOUR, s.LastTelemetryAtUTC, CURRENT_TIMESTAMP(6)) > 24 THEN 'STALE'
            WHEN TIMESTAMPDIFF(HOUR, s.LastTelemetryAtUTC, CURRENT_TIMESTAMP(6)) > 6 THEN 'AGING'
            ELSE 'FRESH'
        END AS TelemetryDataFreshness,
        
        -- Hours since last telemetry
        TIMESTAMPDIFF(
            HOUR, 
            s.LastTelemetryAtUTC, 
            CURRENT_TIMESTAMP(6)
        ) AS HoursSinceLastTelemetry,
        
        -- Overall health score (0-100)
        CASE 
            WHEN s.Status = 'ALARM' THEN 0
            WHEN s.LastTelemetryStatus = 'VIOLATION' THEN 30
            WHEN s.LastTelemetryStatus = 'UNKNOWN' THEN 50
            WHEN TIMESTAMPDIFF(HOUR, s.LastTelemetryAtUTC, CURRENT_TIMESTAMP(6)) > 24 THEN 40
            WHEN s.LastTelemetryStatus = 'OK' THEN 100
            ELSE 70
        END AS HealthScore
        
    FROM Shipments s
    
    -- INNER JOIN: Cargo profile is mandatory
    INNER JOIN CargoProfiles cp 
        ON s.CargoProfileID = cp.CargoProfileID
    
    -- LEFT JOINs: Optional relationships
    LEFT JOIN Ports origin 
        ON s.OriginPortCode = origin.PortCode
    LEFT JOIN Ports dest 
        ON s.DestinationPortCode = dest.PortCode
    LEFT JOIN Ports current_port 
        ON s.CurrentPortCode = current_port.PortCode
    LEFT JOIN Parties shipper 
        ON s.ShipperPartyID = shipper.PartyID
    LEFT JOIN Parties consignee 
        ON s.ConsigneePartyID = consignee.PartyID
    
    WHERE s.ShipmentID = p_ShipmentID;
    
    
    -- ========================================================================
    -- RESULT SET 2: Chain of Custody (Audit Trail)
    -- ========================================================================
    -- Mục đích: Xác định các chặng chịu trách nhiệm pháp lý
    -- Sử dụng: Compliance, dispute resolution, liability tracking
    -- 
    -- OPTIMIZATION:
    -- - USE INDEX hint để force idx_ownership_shipment_end
    -- - Window function ROW_NUMBER() cho sequence
    -- - LEFT JOINs cho optional witness
    -- - ORDER BY với indexed column
    -- 
    -- COST ANALYSIS:
    -- - Index range scan: O(log n + k) với k = số ownership records
    -- - JOINs: O(k) với k ownership records
    -- - Window function: O(k log k)
    -- - Total: O(k log k) - acceptable cho k < 100
    -- ========================================================================
    SELECT 
        -- ====================================================================
        -- Ownership Identity
        -- ====================================================================
        o.OwnershipID,
        o.ShipmentID,
        
        -- ====================================================================
        -- Party Information
        -- ====================================================================
        o.PartyID,
        p.Name AS PartyName,
        p.PartyType,
        p.Email AS PartyEmail,
        p.Phone AS PartyPhone,
        p.Status AS PartyStatus,
        
        -- ====================================================================
        -- Ownership Timeline
        -- ====================================================================
        o.StartAtUTC,
        o.EndAtUTC,
        
        -- Status classification
        CASE 
            WHEN o.EndAtUTC IS NULL THEN 'ACTIVE'
            ELSE 'COMPLETED'
        END AS OwnershipStatus,
        
        -- ====================================================================
        -- Duration Calculations
        -- ====================================================================
        
        -- Duration in hours
        TIMESTAMPDIFF(
            HOUR, 
            o.StartAtUTC, 
            COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))
        ) AS DurationHours,
        
        -- Duration in days (rounded)
        ROUND(
            TIMESTAMPDIFF(
                HOUR, 
                o.StartAtUTC, 
                COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))
            ) / 24.0,
            1
        ) AS DurationDays,
        
        -- Duration in minutes (for short transits)
        TIMESTAMPDIFF(
            MINUTE, 
            o.StartAtUTC, 
            COALESCE(o.EndAtUTC, CURRENT_TIMESTAMP(6))
        ) AS DurationMinutes,
        
        -- ====================================================================
        -- Handover Details
        -- ====================================================================
        o.HandoverPortCode,
        port.Name AS HandoverPortName,
        port.Country AS HandoverCountry,
        port.Latitude AS HandoverLatitude,
        port.Longitude AS HandoverLongitude,
        
        o.HandoverCondition,
        o.HandoverNotes,
        
        -- ====================================================================
        -- Witness Information (Optional)
        -- ====================================================================
        o.WitnessPartyID,
        witness.Name AS WitnessName,
        witness.PartyType AS WitnessType,
        witness.Email AS WitnessEmail,
        
        -- ====================================================================
        -- Digital Signature & Verification
        -- ====================================================================
        o.HandoverSignature,
        
        -- Signature verification status
        CASE 
            WHEN o.HandoverSignature IS NOT NULL THEN 'SIGNED'
            WHEN o.EndAtUTC IS NOT NULL THEN 'UNSIGNED'
            ELSE 'PENDING'
        END AS SignatureStatus,
        
        -- ====================================================================
        -- Sequence & Ordering
        -- ====================================================================
        
        -- Sequence number (1st owner, 2nd owner, etc.)
        ROW_NUMBER() OVER (ORDER BY o.StartAtUTC) AS OwnershipSequence,
        
        -- Total number of transfers
        COUNT(*) OVER () AS TotalTransfers,
        
        -- Is this the current owner?
        CASE 
            WHEN o.EndAtUTC IS NULL THEN 1
            ELSE 0
        END AS IsCurrentOwner,
        
        -- ====================================================================
        -- Risk Indicators
        -- ====================================================================
        
        -- Handover risk score
        CASE 
            WHEN o.HandoverCondition = 'DAMAGED' THEN 'HIGH'
            WHEN o.HandoverCondition = 'PARTIAL' THEN 'MEDIUM'
            WHEN o.HandoverSignature IS NULL AND o.EndAtUTC IS NOT NULL THEN 'MEDIUM'
            ELSE 'LOW'
        END AS HandoverRiskLevel,
        
        -- Compliance flags
        CASE 
            WHEN o.HandoverSignature IS NULL AND o.EndAtUTC IS NOT NULL THEN 1
            ELSE 0
        END AS MissingSignatureFlag,
        
        CASE 
            WHEN o.HandoverCondition != 'GOOD' THEN 1
            ELSE 0
        END AS DamageFlag
        
    FROM Ownership o USE INDEX (idx_ownership_shipment_end)
    
    -- INNER JOIN: Party is mandatory
    INNER JOIN Parties p 
        ON o.PartyID = p.PartyID
    
    -- LEFT JOINs: Optional relationships
    LEFT JOIN Ports port 
        ON o.HandoverPortCode = port.PortCode
    LEFT JOIN Parties witness 
        ON o.WitnessPartyID = witness.PartyID
    
    WHERE o.ShipmentID = p_ShipmentID
    
    -- Chronological order (oldest first)
    ORDER BY o.StartAtUTC ASC;
    
    
    -- ========================================================================
    -- RESULT SET 3: Alarm History
    -- ========================================================================
    -- Mục đích: Hiển thị tất cả incidents trong hành trình
    -- Sử dụng: Risk assessment, quality control, SLA monitoring
    -- ========================================================================
    -- Tối ưu: Sử dụng index idx_alarm_shipment_at
    -- ========================================================================
    SELECT 
        a.AlarmEventID,
        a.ShipmentID,
        
        -- Alarm classification
        a.AlarmType,
        a.Severity,
        a.Status,
        a.AlarmReason,
        a.Source,
        
        -- Timeline
        a.AlarmAtUTC,
        a.AcknowledgedAtUTC,
        a.ResolvedAtUTC,
        
        -- Response time metrics
        CASE 
            WHEN a.AcknowledgedAtUTC IS NOT NULL THEN
                TIMESTAMPDIFF(MINUTE, a.AlarmAtUTC, a.AcknowledgedAtUTC)
            ELSE NULL
        END AS AcknowledgeTimeMinutes,
        
        CASE 
            WHEN a.ResolvedAtUTC IS NOT NULL THEN
                TIMESTAMPDIFF(HOUR, a.AlarmAtUTC, a.ResolvedAtUTC)
            ELSE NULL
        END AS ResolutionTimeHours,
        
        -- Responsible parties
        a.AcknowledgedBy,
        a.ResolvedBy,
        
        -- Timestamps
        a.CreatedAtUTC,
        
        -- Status indicators
        CASE 
            WHEN a.Status = 'OPEN' AND TIMESTAMPDIFF(HOUR, a.AlarmAtUTC, CURRENT_TIMESTAMP(6)) > 24 
            THEN 'OVERDUE'
            WHEN a.Status = 'OPEN' 
            THEN 'PENDING'
            ELSE a.Status
        END AS AlarmStatusDetail
        
    FROM AlarmEvents a
    WHERE a.ShipmentID = p_ShipmentID
    ORDER BY a.AlarmAtUTC DESC;  -- Most recent first
    
    
    -- ========================================================================
    -- RESULT SET 4: Route Statistics Summary
    -- ========================================================================
    -- Mục đích: Tổng hợp metrics cho dashboard
    -- Sử dụng: Executive summary, KPI tracking
    -- ========================================================================
    SELECT 
        p_ShipmentID AS ShipmentID,
        
        -- Ownership metrics
        (SELECT COUNT(*) 
         FROM Ownership 
         WHERE ShipmentID = p_ShipmentID) AS TotalOwnershipTransfers,
        
        (SELECT COUNT(*) 
         FROM Ownership 
         WHERE ShipmentID = p_ShipmentID 
         AND HandoverCondition != 'GOOD') AS DamagedHandovers,
        
        -- Alarm metrics
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID) AS TotalAlarms,
        
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND AlarmType = 'TEMP_VIOLATION') AS TempViolations,
        
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND Status = 'OPEN') AS OpenAlarms,
        
        (SELECT COUNT(*) 
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND Severity = 'CRITICAL') AS CriticalAlarms,
        
        -- Average resolution time
        (SELECT AVG(TIMESTAMPDIFF(HOUR, AlarmAtUTC, ResolvedAtUTC))
         FROM AlarmEvents 
         WHERE ShipmentID = p_ShipmentID 
         AND Status = 'RESOLVED') AS AvgResolutionTimeHours,
        
        -- Current status
        (SELECT Status FROM Shipments WHERE ShipmentID = p_ShipmentID) AS CurrentStatus,
        
        (SELECT LastTelemetryStatus FROM Shipments WHERE ShipmentID = p_ShipmentID) AS LastTelemetryStatus;
        
END
;;
delimiter ;

-- ----------------------------
-- Triggers structure for table ownership
-- ----------------------------
DROP TRIGGER IF EXISTS `TRG_BLOCK_CUSTODY_WHEN_ALARM`;
delimiter ;;
CREATE TRIGGER `TRG_BLOCK_CUSTODY_WHEN_ALARM` BEFORE INSERT ON `ownership` FOR EACH ROW BEGIN
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
END
;;
delimiter ;

-- ----------------------------
-- Triggers structure for table shipments
-- ----------------------------
DROP TRIGGER IF EXISTS `TRG_CHECK_VIOLATION`;
delimiter ;;
CREATE TRIGGER `TRG_CHECK_VIOLATION` BEFORE UPDATE ON `shipments` FOR EACH ROW BEGIN
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
END
;;
delimiter ;

SET FOREIGN_KEY_CHECKS = 1;
