-- ============================================================================
-- Extra CargoProfiles for testing / dropdowns (INSERT IGNORE — safe to re-run)
-- Aligns with test seed ID style (CP-VACCINE-01) and main seed (CP_*).
-- mysql -u root -p YOUR_DB < src/seed-data/cargo_profiles_extra.sql
-- ============================================================================

INSERT IGNORE INTO CargoProfiles (
  CargoProfileID,
  CargoType,
  CargoName,
  TempMin,
  TempMax,
  HumidityMin,
  HumidityMax,
  MaxTransitHours,
  HandlingInstructions
) VALUES
('CP-VACCINE-01', 'VACCINE', 'Generic vaccine cold chain (test)', 2.00, 8.00, 30.00, 60.00, 72, 'Match seed_test_custody / UI demos.'),
('CP-DEMO-FROZEN-01', 'FROZEN_FOOD', 'Demo frozen export', -25.00, -18.00, NULL, NULL, 200, 'Keep frozen.'),
('CP-DEMO-PHARMA-01', 'PHARMA', 'Demo ambient pharma', 15.00, 25.00, 40.00, 65.00, 120, 'Dry container; avoid moisture.'),
('CP-DEMO-SEAFOOD-01', 'FROZEN_FOOD', 'Chilled seafood', -2.00, 4.00, NULL, NULL, 48, 'Ice-lined; monitor temp.'),
('CP-DEMO-ELECTRONICS-01', 'OTHER', 'High-value electronics', 10.00, 35.00, 30.00, 70.00, 168, 'ESD handling; shock watch.');
                        