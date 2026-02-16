DROP DATABASE IF EXISTS supply_chain_sql;
CREATE DATABASE supply_chain_sql CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE supply_chain_sql;

SET @@session.time_zone = '+00:00';

DROP TABLE IF EXISTS AlarmEvents;
DROP TABLE IF EXISTS Ownership;
DROP TABLE IF EXISTS Shipments;
DROP TABLE IF EXISTS CargoProfiles;
DROP TABLE IF EXISTS Ports;
DROP TABLE IF EXISTS Parties;

CREATE TABLE Parties (
    PartyID       VARCHAR(32)   NOT NULL,
    PartyType     ENUM('OWNER','LOGISTICS','AUDITOR') NOT NULL,
    Name          VARCHAR(255)  NOT NULL,
    CreatedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (PartyID)
) ENGINE=InnoDB;

CREATE TABLE Ports (
    PortCode  VARCHAR(16)   NOT NULL,
    Name      VARCHAR(255)  NOT NULL,
    Country   VARCHAR(128)  NOT NULL,
    PRIMARY KEY (PortCode)
) ENGINE=InnoDB;

CREATE TABLE CargoProfiles (
    CargoType  VARCHAR(32)    NOT NULL,
    TempMin    DECIMAL(6,2)   NOT NULL,
    TempMax    DECIMAL(6,2)   NOT NULL,
    PRIMARY KEY (CargoType),
    CONSTRAINT chk_cargo_temp CHECK (TempMin < TempMax),
    CONSTRAINT chk_cargo_type CHECK (CargoType IN ('VACCINE','FROZEN_FOOD','PHARMA','OTHER'))
) ENGINE=InnoDB;

CREATE TABLE Shipments (
    ShipmentID          VARCHAR(32)   NOT NULL,
    CargoType           VARCHAR(32)   NOT NULL,
    WeightKg            DECIMAL(10,2) NOT NULL,
    ShipperPartyID      VARCHAR(32)   NOT NULL,
    ConsigneePartyID    VARCHAR(32)   NOT NULL,
    OriginPortCode      VARCHAR(16)   NOT NULL,
    DestinationPortCode VARCHAR(16)   NOT NULL,
    Status              ENUM('NORMAL','IN_TRANSIT','ALARM','COMPLETED') NOT NULL,
    CurrentLocation     VARCHAR(255)  NULL,
    CurrentPortCode     VARCHAR(16)   NULL,
    CreatedAtUTC        TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAtUTC        TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    LastTelemetryAtUTC  TIMESTAMP(6)  NULL,
    LastTelemetryStatus ENUM('OK','VIOLATION','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    LastCheckInAtUTC    TIMESTAMP(6)  NULL,
    AlarmAtUTC          TIMESTAMP(6)  NULL,
    AlarmReason         VARCHAR(64)   NULL,
    PRIMARY KEY (ShipmentID),
    CONSTRAINT fk_shipment_cargo        FOREIGN KEY (CargoType)           REFERENCES CargoProfiles(CargoType),
    CONSTRAINT fk_shipment_shipper      FOREIGN KEY (ShipperPartyID)      REFERENCES Parties(PartyID),
    CONSTRAINT fk_shipment_consignee    FOREIGN KEY (ConsigneePartyID)    REFERENCES Parties(PartyID),
    CONSTRAINT fk_shipment_origin       FOREIGN KEY (OriginPortCode)      REFERENCES Ports(PortCode),
    CONSTRAINT fk_shipment_destination  FOREIGN KEY (DestinationPortCode) REFERENCES Ports(PortCode),
    CONSTRAINT fk_shipment_current_port FOREIGN KEY (CurrentPortCode)     REFERENCES Ports(PortCode),
    INDEX idx_shipment_status_updated   (Status, UpdatedAtUTC),
    INDEX idx_shipment_origin_dest      (OriginPortCode, DestinationPortCode),
    INDEX idx_shipment_last_checkin     (LastCheckInAtUTC)
) ENGINE=InnoDB;

CREATE TABLE Ownership (
    OwnershipID       CHAR(36)      NOT NULL,
    ShipmentID        VARCHAR(32)   NOT NULL,
    PartyID           VARCHAR(32)   NOT NULL,
    StartAtUTC        TIMESTAMP(6)  NOT NULL,
    EndAtUTC          TIMESTAMP(6)  NULL,
    HandoverLocation  VARCHAR(255)  NOT NULL,
    HandoverPortCode  VARCHAR(16)   NULL,
    ActiveShipmentID  VARCHAR(32)   AS (CASE WHEN EndAtUTC IS NULL THEN ShipmentID ELSE NULL END) STORED,
    PRIMARY KEY (OwnershipID),
    CONSTRAINT fk_ownership_shipment  FOREIGN KEY (ShipmentID)      REFERENCES Shipments(ShipmentID),
    CONSTRAINT fk_ownership_party     FOREIGN KEY (PartyID)         REFERENCES Parties(PartyID),
    CONSTRAINT fk_ownership_port      FOREIGN KEY (HandoverPortCode) REFERENCES Ports(PortCode),
    CONSTRAINT chk_ownership_dates    CHECK (EndAtUTC IS NULL OR EndAtUTC >= StartAtUTC),
    UNIQUE KEY uq_ownership_active    (ActiveShipmentID),
    INDEX idx_ownership_shipment_end  (ShipmentID, EndAtUTC),
    INDEX idx_ownership_party_start   (PartyID, StartAtUTC)
) ENGINE=InnoDB;

CREATE TABLE AlarmEvents (
    AlarmEventID  CHAR(36)      NOT NULL,
    ShipmentID    VARCHAR(32)   NOT NULL,
    AlarmType     ENUM('TEMP_VIOLATION','CHECKIN_TIMEOUT','MANUAL') NOT NULL,
    AlarmReason   VARCHAR(255)  NOT NULL,
    AlarmAtUTC    TIMESTAMP(6)  NOT NULL,
    Source        ENUM('SQL_TRIGGER','BATCH_SCAN','INTEGRATION') NOT NULL,
    CreatedAtUTC  TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (AlarmEventID),
    CONSTRAINT fk_alarm_shipment FOREIGN KEY (ShipmentID) REFERENCES Shipments(ShipmentID),
    INDEX idx_alarm_shipment_at  (ShipmentID, AlarmAtUTC),
    INDEX idx_alarm_type_at      (AlarmType, AlarmAtUTC)
) ENGINE=InnoDB;
