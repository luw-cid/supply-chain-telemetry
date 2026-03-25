-- ============================================================================
-- SEED DATA FOR TRACE ROUTE API TESTING
-- ============================================================================
-- Purpose: Tạo test data cho API 5.1 - Trace Route
-- Database: MySQL
-- Author: Senior Database Engineer
-- Created: 2026-03-21
--
-- USAGE:
-- mysql -u root -p supply_chain_sql < seed_trace_route_data.sql
-- ============================================================================

USE supply_chain_sql;

-- ============================================================================
-- STEP 1: Clean existing test data (optional)
-- ============================================================================
-- Uncomment nếu muốn reset data
-- DELETE FROM Shipments WHERE ShipmentID IN ('SH001', 'SH002', 'SH003', 'SH004');
-- DELETE FROM CargoProfiles WHERE CargoProfileID IN ('CP001', 'CP002', 'CP003');
-- DELETE FROM Parties WHERE PartyID IN ('PARTY001', 'PARTY002', 'PARTY003', 'PARTY004');
-- DELETE FROM Ports WHERE PortCode IN ('SGSIN', 'HKHKG', 'JPYOK', 'USNYC', 'USLAX');

-- ============================================================================
-- STEP 2: Insert Ports (nếu chưa có)
-- ============================================================================
INSERT IGNORE INTO Ports (PortCode, Name, Country, Latitude, Longitude, Timezone, Status)
VALUES
  ('SGSIN', 'Singapore Port', 'Singapore', 1.3521, 103.8198, 'Asia/Singapore', 'OPERATIONAL'),
  ('HKHKG', 'Hong Kong Port', 'Hong Kong', 22.3193, 114.1694, 'Asia/Hong_Kong', 'OPERATIONAL'),
  ('JPYOK', 'Yokohama Port', 'Japan', 35.4437, 139.6380, 'Asia/Tokyo', 'OPERATIONAL'),
  ('USNYC', 'New York Port', 'USA', 40.7128, -74.0060, 'America/New_York', 'OPERATIONAL'),
  ('USLAX', 'Los Angeles Port', 'USA', 33.7405, -118.2713, 'America/Los_Angeles', 'OPERATIONAL');

-- ============================================================================
-- STEP 3: Insert Parties (Shippers & Consignees)
-- ============================================================================
INSERT IGNORE INTO Parties (PartyID, PartyType, Name, Email, Phone, Address, Status)
VALUES
  ('PARTY001', 'OWNER', 'Singapore Pharma Export Ltd', 'export@sgpharma.com', '+65-6123-4567', '123 Pharma Street, Singapore 123456', 'ACTIVE'),
  ('PARTY002', 'OWNER', 'US Medical Import Corp', 'import@usmedical.com', '+1-212-555-0100', '456 Medical Ave, New York, NY 10001', 'ACTIVE'),
  ('PARTY003', 'OWNER', 'Asia Vaccine Distributor', 'sales@asiavaccine.com', '+852-2345-6789', '789 Vaccine Road, Hong Kong', 'ACTIVE'),
  ('PARTY004', 'OWNER', 'Global Health Solutions', 'logistics@globalhealth.com', '+1-310-555-0200', '321 Health Blvd, Los Angeles, CA 90001', 'ACTIVE');

-- ============================================================================
-- STEP 4: Insert Cargo Profiles
-- ============================================================================
-- CP001: Vaccine (strict temperature control)
INSERT IGNORE INTO CargoProfiles (CargoProfileID, CargoType, CargoName, TempMin, TempMax, HumidityMin, HumidityMax, MaxTransitHours, HandlingInstructions)
VALUES ('CP001', 'VACCINE', 'COVID-19 Vaccine', 2, 8, 40, 70, 168, 'Keep refrigerated at all times. Do not freeze. Handle with care.');

-- CP002: Pharmaceutical (moderate temperature control)
INSERT IGNORE INTO CargoProfiles (CargoProfileID, CargoType, CargoName, TempMin, TempMax, HumidityMin, HumidityMax, MaxTransitHours, HandlingInstructions)
VALUES ('CP002', 'PHARMA', 'Insulin Medication', 15, 25, 30, 80, 240, 'Store in cool, dry place. Protect from direct sunlight.');

-- CP003: Medical Equipment (relaxed temperature control)
INSERT IGNORE INTO CargoProfiles (CargoProfileID, CargoType, CargoName, TempMin, TempMax, HumidityMin, HumidityMax, MaxTransitHours, HandlingInstructions)
VALUES ('CP003', 'OTHER', 'Medical Equipment', 10, 35, 20, 90, 336, 'Handle with care. Keep dry.');

-- ============================================================================
-- STEP 5: Insert Shipments
-- ============================================================================

-- SH001: Singapore → New York (Vaccine, strict control)
-- Status: IN_TRANSIT, có violations
INSERT IGNORE INTO Shipments (
  ShipmentID,
  CargoProfileID,
  WeightKg,
  VolumeM3,
  ShipperPartyID,
  ConsigneePartyID,
  OriginPortCode,
  DestinationPortCode,
  Status,
  CurrentPortCode,
  CurrentLocation,
  TrackingDeviceID,
  LastTelemetryAtUTC,
  LastTelemetryStatus,
  CreatedAtUTC
) VALUES (
  'SH001',
  'CP001',
  15000.00,
  45.00,
  'PARTY001',
  'PARTY002',
  'SGSIN',
  'USNYC',
  'IN_TRANSIT',
  'HKHKG',
  'Hong Kong Port - In Transit',
  'IOT-DEVICE-001',
  NOW(),
  'OK',
  DATE_SUB(NOW(), INTERVAL 2 DAY)
);

-- SH002: Hong Kong → Los Angeles (Pharmaceutical)
-- Status: IN_TRANSIT, no violations
INSERT IGNORE INTO Shipments (
  ShipmentID,
  CargoProfileID,
  WeightKg,
  VolumeM3,
  ShipperPartyID,
  ConsigneePartyID,
  OriginPortCode,
  DestinationPortCode,
  Status,
  CurrentPortCode,
  CurrentLocation,
  TrackingDeviceID,
  LastTelemetryAtUTC,
  LastTelemetryStatus,
  CreatedAtUTC
) VALUES (
  'SH002',
  'CP002',
  12000.00,
  36.00,
  'PARTY003',
  'PARTY004',
  'HKHKG',
  'USLAX',
  'IN_TRANSIT',
  'JPYOK',
  'Yokohama Port - In Transit',
  'IOT-DEVICE-002',
  NOW(),
  'OK',
  DATE_SUB(NOW(), INTERVAL 3 DAY)
);

-- SH003: Singapore → Hong Kong (Medical Equipment)
-- Status: COMPLETED
INSERT IGNORE INTO Shipments (
  ShipmentID,
  CargoProfileID,
  WeightKg,
  VolumeM3,
  ShipperPartyID,
  ConsigneePartyID,
  OriginPortCode,
  DestinationPortCode,
  Status,
  CurrentPortCode,
  CurrentLocation,
  TrackingDeviceID,
  LastTelemetryAtUTC,
  LastTelemetryStatus,
  CreatedAtUTC
) VALUES (
  'SH003',
  'CP003',
  8000.00,
  24.00,
  'PARTY001',
  'PARTY003',
  'SGSIN',
  'HKHKG',
  'COMPLETED',
  'HKHKG',
  'Hong Kong Port - Delivered',
  'IOT-DEVICE-003',
  DATE_SUB(NOW(), INTERVAL 1 DAY),
  'OK',
  DATE_SUB(NOW(), INTERVAL 5 DAY)
);

-- SH004: Test shipment WITHOUT telemetry data (for error testing)
INSERT IGNORE INTO Shipments (
  ShipmentID,
  CargoProfileID,
  WeightKg,
  VolumeM3,
  ShipperPartyID,
  ConsigneePartyID,
  OriginPortCode,
  DestinationPortCode,
  Status,
  CurrentPortCode,
  CurrentLocation,
  TrackingDeviceID,
  LastTelemetryStatus,
  CreatedAtUTC
) VALUES (
  'SH004',
  'CP001',
  10000.00,
  30.00,
  'PARTY001',
  'PARTY002',
  'SGSIN',
  'USNYC',
  'NORMAL',
  'SGSIN',
  'Singapore Port - Pending Departure',
  'IOT-DEVICE-004',
  'UNKNOWN',
  NOW()
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
SELECT '=== PORTS ===' AS '';
SELECT PortCode, Name, Country, Latitude, Longitude, Status 
FROM Ports 
WHERE PortCode IN ('SGSIN', 'HKHKG', 'JPYOK', 'USNYC', 'USLAX');

SELECT '=== PARTIES ===' AS '';
SELECT PartyID, PartyType, Name, Email, Status 
FROM Parties 
WHERE PartyID IN ('PARTY001', 'PARTY002', 'PARTY003', 'PARTY004');

SELECT '=== CARGO PROFILES ===' AS '';
SELECT CargoProfileID, CargoType, CargoName, TempMin, TempMax, HumidityMin, HumidityMax, MaxTransitHours
FROM CargoProfiles 
WHERE CargoProfileID IN ('CP001', 'CP002', 'CP003');

SELECT '=== SHIPMENTS ===' AS '';
SELECT 
  s.ShipmentID,
  s.CargoProfileID,
  cp.CargoType,
  cp.CargoName,
  cp.TempMax AS TempThreshold,
  s.OriginPortCode,
  s.DestinationPortCode,
  s.Status,
  s.WeightKg,
  s.TrackingDeviceID,
  s.LastTelemetryStatus
FROM Shipments s
JOIN CargoProfiles cp ON s.CargoProfileID = cp.CargoProfileID
WHERE s.ShipmentID IN ('SH001', 'SH002', 'SH003', 'SH004')
ORDER BY s.ShipmentID;

SELECT '=== SUMMARY ===' AS '';
SELECT 
  'Ports' AS Entity,
  COUNT(*) AS Count
FROM Ports WHERE PortCode IN ('SGSIN', 'HKHKG', 'JPYOK', 'USNYC', 'USLAX')
UNION ALL
SELECT 'Parties', COUNT(*) FROM Parties WHERE PartyID IN ('PARTY001', 'PARTY002', 'PARTY003', 'PARTY004')
UNION ALL
SELECT 'CargoProfiles', COUNT(*) FROM CargoProfiles WHERE CargoProfileID IN ('CP001', 'CP002', 'CP003')
UNION ALL
SELECT 'Shipments', COUNT(*) FROM Shipments WHERE ShipmentID IN ('SH001', 'SH002', 'SH003', 'SH004');
