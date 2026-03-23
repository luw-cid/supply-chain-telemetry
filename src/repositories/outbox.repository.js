'use strict';

const { pool } = require('../configs/sql.config');

async function fetchAndMarkPendingEvents(batchSize) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, event_type, payload, retry_count
       FROM   outbox_events
       WHERE  status = 'PENDING'
         AND  (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER  BY created_at ASC
       LIMIT  ?
       FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );

    if (rows.length > 0) {
      const ids = rows.map((row) => row.id);
      await connection.query(
        `UPDATE outbox_events
         SET    status = 'PROCESSING'
         WHERE  id IN (?)`,
        [ids]
      );
    }

    await connection.commit();

    return rows.map((row) => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function markProcessed(id) {
  await pool.query(
    `UPDATE outbox_events
     SET status       = 'PROCESSED',
         processed_at = CURRENT_TIMESTAMP(6)
     WHERE id = ?`,
    [id]
  );
}

async function markFailed(id, errorMsg) {
  await pool.query(
    `UPDATE outbox_events
     SET status     = 'FAILED',
         last_error = ?
     WHERE id = ?`,
    [errorMsg ? errorMsg.substring(0, 500) : 'Unknown error', id]
  );
}

async function markRetry(id, newRetryCount, errorMsg) {
  await pool.query(
    `UPDATE outbox_events
     SET status      = 'PENDING',
         retry_count = ?,
         last_error  = ?
     WHERE id = ?`,
    [newRetryCount, errorMsg ? errorMsg.substring(0, 500) : 'Unknown error', id]
  );
}

module.exports = {
  fetchAndMarkPendingEvents,
  markProcessed,
  markFailed,
  markRetry,
};
