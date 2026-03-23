-- Seed data cho bảng CargoProfiles
INSERT INTO CargoProfiles (
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
('CP_VAC_COVID19',   'VACCINE',      'COVID-19 Vaccine',     2.00,   8.00,  30.00, 60.00, 72, 'Keep refrigerated. Do not freeze.'),
('CP_VAC_FLU',       'VACCINE',      'Flu Vaccine',          2.00,   8.00,  30.00, 65.00, 96, 'Maintain cold chain continuously.'),
('CP_PHARMA_INSULIN','PHARMA',       'Insulin',              2.00,   8.00,  35.00, 60.00, 48, 'Protect from direct light.'),
('CP_PHARMA_BIO',    'PHARMA',       'Biologic Drug',        2.00,   8.00,  30.00, 55.00, 36, 'Handle with care. Avoid shaking.'),
('CP_FROZEN_SEAFOOD','FROZEN_FOOD',  'Frozen Seafood',     -25.00, -18.00, NULL,   NULL, 240, 'Keep frozen at all times.'),
('CP_FROZEN_MEAT',   'FROZEN_FOOD',  'Frozen Meat',        -22.00, -18.00, NULL,   NULL, 216, 'Do not thaw during transit.'),
('CP_FRESH_FRUIT',   'OTHER',        'Fresh Fruit',           4.00,  12.00,  70.00, 90.00, 120, 'Ventilated container required.'),
('CP_ELECTRONICS',   'OTHER',        'Sensitive Electronics',10.00,  30.00,  20.00, 50.00, 168, 'Avoid condensation and shock.');