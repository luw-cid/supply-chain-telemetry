/**
 * Seed all port-related data used by the route optimization feature.
 *
 * - MySQL: Ports from src/seed-data/ports.sql and src/seed-data/ports_extra.sql
 * - MongoDB: Port edges from src/seed-data/port_edges_route_optimization_test.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mysql = require('mysql2/promise');
const mongoose = require('mongoose');

const PortEdges = require('../../models/mongodb/port_edges');

function splitSqlStatements(sqlText) {
  const lines = sqlText
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, '').trim())
    .filter(Boolean);

  return lines
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !/^USE\s+/i.test(statement));
}

async function runSqlFile(pool, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY' && /^INSERT\s+/i.test(statement)) {
        continue;
      }
      throw error;
    }
  }
}

async function seedMySqlPorts() {
  const pool = mysql.createPool({
    host: process.env.MySQL_HOST || 'localhost',
    user: process.env.MySQL_USER || 'root',
    password: process.env.MySQL_PASSWORD || '',
    database: process.env.MySQL_DATABASE || 'supply_chain_sql',
    port: Number(process.env.MySQL_PORT || 3306),
    multipleStatements: true,
  });

  const portsFile = path.join(__dirname, '..', '..', 'seed-data', 'ports.sql');
  const portsExtraFile = path.join(__dirname, '..', '..', 'seed-data', 'ports_extra.sql');

  await runSqlFile(pool, portsFile);
  await runSqlFile(pool, portsExtraFile);

  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM Ports');
  console.log(`[MySQL] Ports seeded. Total ports: ${rows[0].total}`);

  await pool.end();
}

async function seedMongoEdges() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Missing MONGO_URI in src/.env');
  }

  await mongoose.connect(uri);

  const edgesFile = path.join(__dirname, '..', '..', 'seed-data', 'port_edges_route_optimization_test.json');
  const edges = JSON.parse(fs.readFileSync(edgesFile, 'utf8'));

  await PortEdges.deleteMany({});
  const inserted = await PortEdges.insertMany(edges);

  console.log(`[MongoDB] Port edges seeded. Inserted ${inserted.length} edges.`);
  console.log(`[MongoDB] Total edges now: ${await PortEdges.countDocuments({})}`);

  await mongoose.disconnect();
}

async function main() {
  await seedMySqlPorts();
  await seedMongoEdges();

  console.log('✅ All port data seeded successfully.');
}

main().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});