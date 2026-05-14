-- ============================================================================
-- Fix Custody Chain for SHP-1778688720701
-- Make transfers happen at different ports to visualize the route
-- ============================================================================

USE supply_chain_sql;

-- Update ownership records to use different ports for each transfer
UPDATE Ownership 
SET HandoverPortCode = 'VNSGN'  -- Saigon Port (Vietnam)
WHERE ShipmentID = 'SHP-1778688720701' 
  AND PartyID = 'PARTY-OWN-003'
  AND StartAtUTC = (
    SELECT MIN(StartAtUTC) 
    FROM (SELECT * FROM Ownership) AS o 
    WHERE o.ShipmentID = 'SHP-1778688720701'
  );

UPDATE Ownership 
SET HandoverPortCode = 'SGSIN'  -- Singapore Port
WHERE ShipmentID = 'SHP-1778688720701' 
  AND PartyID = 'PARTY-LOG-002'
  AND EndAtUTC IS NOT NULL;

UPDATE Ownership 
SET HandoverPortCode = 'MYPNG'  -- Penang Port (Malaysia) - keep current
WHERE ShipmentID = 'SHP-1778688720701' 
  AND PartyID = 'PARTY-OWN-002'
  AND EndAtUTC IS NULL;

-- Verify the changes
SELECT 
  o.ShipmentID,
  o.PartyID,
  p.Name AS PartyName,
  o.HandoverPortCode,
  pt.Name AS PortName,
  o.StartAtUTC,
  o.EndAtUTC,
  CASE WHEN o.EndAtUTC IS NULL THEN 'ACTIVE' ELSE 'TRANSFERRED' END AS Status
FROM Ownership o
LEFT JOIN Parties p ON o.PartyID = p.PartyID
LEFT JOIN Ports pt ON o.HandoverPortCode = pt.PortCode
WHERE o.ShipmentID = 'SHP-1778688720701'
ORDER BY o.StartAtUTC;
