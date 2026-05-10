require('dotenv').config({ path: './.env' });
const { pool } = require('./configs/sql.config');

async function test() {
  try {
    const [result] = await pool.query(`
      INSERT INTO alarmevents (AlarmEventID, ShipmentID, AlarmType, Severity, Status, AlarmReason, Source)
      VALUES (UUID(), 'SHP-002', 'TEMP_VIOLATION', 'HIGH', 'OPEN', 'Nhiệt độ vượt ngưỡng (TEST)', 'INTEGRATION')
    `);
    console.log('Inserted test alarm event:', result);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
