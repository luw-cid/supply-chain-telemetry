const fs = require('fs').promises;
const path = require('path');
const { pool } = require('./sql.config');

const SQL_DIR = path.join(__dirname, '..', 'database', 'sql');

/**
 * Normalize SQL content for execution:
 * - Remove USE statements
 * - Remove DELIMITER lines  
 * - Split by the given delimiter (default ';')
 * - Strip comments, filter empties
 */
function parseStatements(content, delimiter = ';') {
  return content
    .split('\n')
    .filter(line => !line.trim().toUpperCase().startsWith('USE ') && !line.trim().toUpperCase().startsWith('DELIMITER'))
    .join('\n')
    .split(delimiter)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
}

async function runFile(connection, filePath, label) {
  const content = await fs.readFile(filePath, 'utf8');
  const hasCustomDelimiter = content.includes('DELIMITER');

  const delimiter = hasCustomDelimiter ? '$$' : ';';
  const statements = parseStatements(content, delimiter);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.length < 10) continue;
    try {
      await connection.query(stmt);
    } catch (error) {
      console.warn(`[Migration] Warning at ${label} stmt ${i + 1}:`, error.message);
    }
  }
}

async function runMigration() {
  try {
    console.log('[Migration] Starting...');
    const connection = await pool.getConnection();

    try {
      const schemaPath = path.join(__dirname, 'mysql.sql');
      console.log('[Migration] Running schema...');
      await runFile(connection, schemaPath, 'schema');

      const extraFiles = [
        'sp_change_custody.sql',
        'sp_trace_route_context.sql',
        'recursive_cte_chain_of_custody.sql',
        'triggers_violation_and_custody.sql',
        'outbox_events_table.sql',
        'create_indexes.sql',
      ];

      for (const file of extraFiles) {
        const fp = path.join(SQL_DIR, file);
        try {
          await fs.access(fp);
          console.log(`[Migration] Running ${file}...`);
          await runFile(connection, fp, file);
        } catch {
          console.warn(`[Migration] Skipping ${file} (not found)`);
        }
      }

      console.log('[Migration] Complete');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[Migration] Error:', error);
    throw error;
  }
}

module.exports = { runMigration };
