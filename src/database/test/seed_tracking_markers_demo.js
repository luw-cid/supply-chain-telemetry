/**
 * Seed data for Option A (tracking_events markers) demo.
 *
 * - Seed MySQL: parties, ports, cargo profile, shipments, ownership, test user
 * - Seed MongoDB: telemetry_points for a shipment so Tracking Map can render a route
 *
 * Run:
 *   node src/database/test/seed_tracking_markers_demo.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');

const TelemetryPoints = require('../../models/mongodb/telemetry_points');
const TrackingEvents = require('../../models/mongodb/tracking_events');

const TEST_SHIPMENTS = ['SHP-TRANSFER-OK', 'SHP-ALARM-001', 'SHP-HISTORY-001'];
const TEST_PARTIES = ['PARTY-OWNER-001', 'PARTY-LOG-001', 'PARTY-LOG-002', 'PARTY-AUD-001'];
const TEST_CARGO = ['CP-VACCINE-01'];
const TEST_USER_EMAILS = ['testuser@custody.vn'];

function splitSqlStatements(sqlText) {
  // Remove comments and split by ';' while keeping simple scripts safe.
  const lines = sqlText
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, '').trim())
    .filter(Boolean);
  const joined = lines.join('\n');
  return joined
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^USE\s+/i.test(s));
}

function extractFirstColumnCodesFromPortsSeed(sqlText) {
  // ports.sql uses tuples like ('VNSGN', 'Name', ...)
  const codes = [];
  const re = /\(\s*'([^']+)'\s*,\s*'[^']*'\s*,/g;
  let m;
  while ((m = re.exec(sqlText)) !== null) {
    codes.push(m[1]);
  }
  return Array.from(new Set(codes));
}

async function runSqlFile(pool, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const stmts = splitSqlStatements(sql);
  for (const stmt of stmts) {
    try {
      await pool.query(stmt);
    } catch (e) {
      // Idempotent seeding: ignore duplicate key errors for INSERT statements.
      if (e && e.code === 'ER_DUP_ENTRY' && /^INSERT\s+/i.test(stmt)) {
        continue;
      }
      throw e;
    }
  }
}

async function cleanupMySql(pool) {
  // Remove custody demo data (safe to re-run)
  await pool.query(
    `DELETE FROM Ownership WHERE ShipmentID IN (${TEST_SHIPMENTS.map(() => '?').join(',')})`,
    TEST_SHIPMENTS,
  );
  await pool.query(
    `DELETE FROM Shipments WHERE ShipmentID IN (${TEST_SHIPMENTS.map(() => '?').join(',')})`,
    TEST_SHIPMENTS,
  );
  await pool.query(
    `DELETE FROM Users WHERE Email IN (${TEST_USER_EMAILS.map(() => '?').join(',')})`,
    TEST_USER_EMAILS,
  );
  await pool.query(
    `DELETE FROM CargoProfiles WHERE CargoProfileID IN (${TEST_CARGO.map(() => '?').join(',')})`,
    TEST_CARGO,
  );
  await pool.query(
    `DELETE FROM Parties WHERE PartyID IN (${TEST_PARTIES.map(() => '?').join(',')})`,
    TEST_PARTIES,
  );

  // Remove ports that will be re-seeded from ports.sql/ports_extra.sql
  const portsFile = path.join(__dirname, '..', '..', 'seed-data', 'ports.sql');
  const portsExtraFile = path.join(__dirname, '..', '..', 'seed-data', 'ports_extra.sql');
  const portsSql = fs.readFileSync(portsFile, 'utf8');
  const portsExtraSql = fs.readFileSync(portsExtraFile, 'utf8');
  const portCodes = [
    ...extractFirstColumnCodesFromPortsSeed(portsSql),
    ...extractFirstColumnCodesFromPortsSeed(portsExtraSql),
  ];
  const uniquePortCodes = Array.from(new Set(portCodes));

  // NOTE: Do NOT delete Ports here.
  // Ports are referenced by many Shipments via foreign keys, so deleting them can fail.
  // We rely on (idempotent) INSERT / INSERT IGNORE when seeding ports instead.
}

async function seedMySql() {
  const pool = mysql.createPool({
    host: process.env.MySQL_HOST || 'localhost',
    user: process.env.MySQL_USER || 'root',
    password: process.env.MySQL_PASSWORD || '',
    database: process.env.MySQL_DATABASE || 'supply_chain_sql',
    port: Number(process.env.MySQL_PORT || 3306),
    multipleStatements: true,
  });

  // Clean old demo data first
  await cleanupMySql(pool);

  // Seed Ports from src/seed-data/ports.sql (as requested)
  const portsFile = path.join(__dirname, '..', '..', 'seed-data', 'ports.sql');
  const portsExtraFile = path.join(__dirname, '..', '..', 'seed-data', 'ports_extra.sql');
  await runSqlFile(pool, portsFile);
  await runSqlFile(pool, portsExtraFile);

  // Seed Parties/Shipments/Ownership/Test user
  const seedFile = path.join(__dirname, 'seed_test_custody.sql');
  try {
    await runSqlFile(pool, seedFile);
  } catch (e) {
    // Some environments enforce triggers that may block inserting ownership for ALARM shipments.
    // Fall back to reset script (inserts SHP-ALARM-001 as NORMAL then updates to ALARM).
    const resetFile = path.join(__dirname, '../../test/reset_test_data.sql');
    await runSqlFile(pool, resetFile);
  }

  // Make CurrentLocation non-empty so marker label is meaningful.
  await pool.query(
    "UPDATE Shipments SET CurrentLocation = 'Saigon Port' WHERE ShipmentID IN ('SHP-TRANSFER-OK','SHP-ALARM-001') AND (CurrentLocation IS NULL OR CurrentLocation = '')",
  );
  await pool.query(
    "UPDATE Shipments SET CurrentLocation = 'Singapore Port' WHERE ShipmentID = 'SHP-HISTORY-001' AND (CurrentLocation IS NULL OR CurrentLocation = '')",
  );

  await pool.end();
}

async function seedMongoTelemetry() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGO_URI in src/.env');
  await mongoose.connect(uri);

  // Clean old demo data
  await TelemetryPoints.deleteMany({ 'meta.shipment_id': { $in: TEST_SHIPMENTS } });
  await TrackingEvents.deleteMany({ shipment_id: { $in: TEST_SHIPMENTS } });

  const shipmentId = 'SHP-TRANSFER-OK';

  const now = Date.now();
  const pts = [];

  // Maritime-ish path (offshore) for "sea transport" context:
  // Start near southern coast (offshore from HCMC), move east into sea, then north along coast to Hai Phong offshore.
  const start = [107.2, 10.2]; // [lng, lat]
  const mid = [112.0, 12.8];
  const end = [107.6, 20.9]; // near Hai Phong offshore

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  for (let i = 0; i < 30; i++) {
    const tstamp = new Date(now - (30 - i) * 7 * 60 * 1000);
    const p = i / 29;
    const seg = p < 0.45 ? 0 : 1;
    const localT = seg === 0 ? p / 0.45 : (p - 0.45) / 0.55;

    const from = seg === 0 ? start : mid;
    const to = seg === 0 ? mid : end;

    // Add slight jitter so it's not a perfect straight line.
    const jitterLng = (Math.random() - 0.5) * 0.08;
    const jitterLat = (Math.random() - 0.5) * 0.06;

    const lng = lerp(from[0], to[0], localT) + jitterLng;
    const lat = lerp(from[1], to[1], localT) + jitterLat;

    const temp = 6 + (i % 4); // 6..9
    pts.push({
      meta: { shipment_id: shipmentId, device_id: 'IOT-DEMO-01' },
      t: tstamp,
      location: { type: 'Point', coordinates: [lng, lat] },
      temp,
      humidity: 55,
    });
  }

  await TelemetryPoints.insertMany(pts);
  await mongoose.disconnect();
}

async function main() {
  await seedMySql();
  await seedMongoTelemetry();
  console.log('✅ Seed completed.');
  console.log('- MySQL: seeded Parties/Ports/CargoProfiles/Shipments/Ownership/Test user');
  console.log("- MongoDB: seeded telemetry_points for SHP-TRANSFER-OK (30 points)");
  console.log('');
  console.log('Next manual test:');
  console.log('1) Login: testuser@custody.vn / Password@123');
  console.log("2) Call transfer: POST /api/v1/shipments/SHP-TRANSFER-OK/transfer");
  console.log("3) Open Tracking Map: /tracking-map?shipmentId=SHP-TRANSFER-OK");
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});

