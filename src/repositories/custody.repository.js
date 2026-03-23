'use strict';

const { pool } = require('../configs/sql.config');

async function initializeOutParams() {
  await pool.query('SET @p_success = 0, @p_message = NULL');
}

async function executeChangeCustody({
  shipmentId,
  fromPartyId,
  toPartyId,
  handoverPortCode,
  handoverCondition,
  handoverNotes,
  handoverSignature,
  witnessPartyId,
}) {
  await pool.query(
    `CALL sp_change_custody(
      ?, ?, ?, ?, ?, ?, ?, ?,
      @p_success, @p_message
    )`,
    [
      shipmentId,
      fromPartyId,
      toPartyId,
      handoverPortCode,
      handoverCondition,
      handoverNotes,
      handoverSignature,
      witnessPartyId,
    ]
  );
}

async function getChangeCustodyOutParams() {
  const [[outRow]] = await pool.query(
    'SELECT @p_success AS success, @p_message AS message'
  );

  return {
    success: Number(outRow.success) === 1,
    message: outRow.message,
  };
}

async function fetchOwnershipHistory(shipmentId, detailLevel) {
  const [result] = await pool.query(
    'CALL SP_TraceChainOfCustodyRecursive(?, ?)',
    [shipmentId, detailLevel]
  );

  return Array.isArray(result) ? result : [];
}

module.exports = {
  initializeOutParams,
  executeChangeCustody,
  getChangeCustodyOutParams,
  fetchOwnershipHistory,
};
