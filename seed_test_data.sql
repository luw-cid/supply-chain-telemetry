-- ============================================================================
-- SEED DATA for E2E Test Flows
-- Chạy trước khi chạy test_e2e.ps1
-- ============================================================================
USE supply_chain_sql;

-- ── Parties ────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO Parties (PartyID, PartyType, Name, Email, Phone, Status) VALUES
  ('PARTY-SHIPPER-01', 'OWNER',     'Global Trade Corp',     'gtc@trade.com',     '+84901000001', 'ACTIVE'),
  ('PARTY-CONSIGN-01','LOGISTICS',  'Vietnam Logistics Ltd',  'vn@logistics.vn',   '+84901000002', 'ACTIVE'),
  ('PARTY-LOG-001',   'LOGISTICS',  'Saigon Logistics Co.',   'sg@log.vn',         '+84901000003', 'ACTIVE'),
  ('PARTY-LOG-002',   'LOGISTICS',  'Hanoi Freight Ltd.',     'hn@log.vn',         '+84901000004', 'ACTIVE');

-- ── Ports ─────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO Ports (PortCode, Name, Country, Latitude, Longitude, Timezone, Status) VALUES
  ('VNSGN', 'Saigon Port',      'Vietnam',   10.78330000, 106.70420000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
  ('VNHPH', 'Hai Phong Port',   'Vietnam',   20.84490000, 106.68810000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
  ('SGSIN', 'Singapore Port',   'Singapore',  1.29660000, 103.77640000, 'Asia/Singapore',   'OPERATIONAL');

-- ── CargoProfiles ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO CargoProfiles (CargoProfileID, CargoType, CargoName, TempMin, TempMax) VALUES
  ('CP-VACCINE-01', 'VACCINE', 'COVID-19 Vaccine', 2.00, 8.00),
  ('CP-FROZEN-01',  'FROZEN_FOOD', 'Frozen Seafood', -18.00, -12.00);

-- ── Shipments ─────────────────────────────────────────────────────────────────
INSERT IGNORE INTO Shipments
  (ShipmentID, CargoProfileID, WeightKg, ShipperPartyID, ConsigneePartyID,
   OriginPortCode, DestinationPortCode, Status, CurrentPortCode)
VALUES
  ('SHP-E2E-001',  'CP-VACCINE-01', 500.00, 'PARTY-SHIPPER-01', 'PARTY-CONSIGN-01', 'VNSGN', 'VNHPH', 'NORMAL', 'VNSGN'),
  ('SHP-E2E-002',  'CP-FROZEN-01',  300.00, 'PARTY-SHIPPER-01', 'PARTY-CONSIGN-01', 'VNHPH', 'SGSIN', 'NORMAL', 'VNHPH');

-- ── User ─────────────────────────────────────────────────────────────────────
-- Password "123123123" bcrypt hash (10 rounds)
INSERT IGNORE INTO Users (UserID, Name, Email, Phone, PasswordHash, Role, PartyID, Status)
SELECT UUID(), 'Test Admin', 'dhoang1234sp@gmail.com', '+84012345678',
  '$2b$10$jdrT/9YOWBWOxMXNlmlS0OVPafSBBLdgncMXGel1rkQw0gsMBLzJG',
  'ADMIN', NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'dhoang1234sp@gmail.com');

SELECT 'Seed complete!' AS status;
