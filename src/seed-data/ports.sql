-- Seed data cho bảng Ports
INSERT INTO Ports (
  PortCode,
  Name,
  Country,
  Latitude,
  Longitude,
  Timezone,
  Status
) VALUES
('VNSGN', 'Cat Lai Port (Ho Chi Minh City)', 'Vietnam', 10.76990000, 106.70810000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
('VNHPH', 'Hai Phong Port', 'Vietnam', 20.86480000, 106.68380000, 'Asia/Ho_Chi_Minh', 'OPERATIONAL'),
('SGSIN', 'Port of Singapore', 'Singapore', 1.26440000, 103.84050000, 'Asia/Singapore', 'OPERATIONAL'),
('HKHKG', 'Port of Hong Kong', 'Hong Kong', 22.30800000, 114.22500000, 'Asia/Hong_Kong', 'OPERATIONAL'),
('CNSHA', 'Port of Shanghai', 'China', 31.23040000, 121.47370000, 'Asia/Shanghai', 'OPERATIONAL'),
('CNSZX', 'Port of Shenzhen', 'China', 22.54310000, 114.05790000, 'Asia/Shanghai', 'OPERATIONAL'),
('JPTYO', 'Port of Tokyo', 'Japan', 35.67620000, 139.65030000, 'Asia/Tokyo', 'OPERATIONAL'),
('KRPUS', 'Port of Busan', 'South Korea', 35.10280000, 129.04030000, 'Asia/Seoul', 'OPERATIONAL'),
('NLRTM', 'Port of Rotterdam', 'Netherlands', 51.92440000, 4.47770000, 'Europe/Amsterdam', 'OPERATIONAL'),
('DEHAM', 'Port of Hamburg', 'Germany', 53.55110000, 9.99370000, 'Europe/Berlin', 'OPERATIONAL'),
('BEANR', 'Port of Antwerp', 'Belgium', 51.21940000, 4.40250000, 'Europe/Brussels', 'OPERATIONAL'),
('GBFXT', 'Port of Felixstowe', 'United Kingdom', 51.96360000, 1.35110000, 'Europe/London', 'OPERATIONAL'),
('USLAX', 'Port of Los Angeles', 'United States', 33.74050000, -118.27190000, 'America/Los_Angeles', 'OPERATIONAL'),
('USNYC', 'Port of New York and New Jersey', 'United States', 40.71280000, -74.00600000, 'America/New_York', 'OPERATIONAL'),
('AEJEA', 'Port of Jebel Ali', 'United Arab Emirates', 25.01130000, 55.06120000, 'Asia/Dubai', 'OPERATIONAL');