USE supply_chain_sql;

INSERT INTO Parties (PartyID, PartyType, Name, Email, Phone, Address, Status)
VALUES
('P_OWNER_001', 'OWNER', 'Owner Company 001', 'owner001@example.com', '+84901234567', 'HCMC, Vietnam', 'ACTIVE'),
('P_LOG_001',   'LOGISTICS', 'Logistics Company 001', 'log001@example.com', '+84908887766', 'Singapore', 'ACTIVE'),
('P_AUD_001',   'AUDITOR', 'Auditor Company 001', 'aud001@example.com', '+84906665544', 'Hanoi, Vietnam', 'ACTIVE');