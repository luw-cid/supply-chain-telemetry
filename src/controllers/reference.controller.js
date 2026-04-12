const shipmentRepository = require('../repositories/shipment.repository');
const portService = require('../services/port.service');
const partyService = require('../services/party.service');

function buildAuditContext(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ipFromFwd = typeof fwd === 'string' ? fwd.split(',')[0].trim() : null;
  return {
    changedBy: req.user?.sub || 'unknown',
    clientIp: req.ip || ipFromFwd || null,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 255) || null,
  };
}

async function listPortsController(req, res, next) {
  try {
    const q = String(req.query.all || '').toLowerCase();
    const includeAllRequested = q === '1' || q === 'true' || q === 'yes';
    const mq = String(req.query.map || '').toLowerCase();
    const forMap = mq === '1' || mq === 'true' || mq === 'yes';
    const role = req.user?.role || '';
    const data = await portService.listPortsForUser({ role, includeAllRequested, forMap });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function createPortController(req, res, next) {
  try {
    const data = await portService.createPort(req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updatePortController(req, res, next) {
  try {
    const { portCode } = req.params;
    const data = await portService.updatePort(portCode, req.body || {});
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function deletePortController(req, res, next) {
  try {
    const { portCode } = req.params;
    const data = await portService.deletePort(portCode);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function listPartiesController(req, res, next) {
  try {
    const q = String(req.query.all || '').toLowerCase();
    const includeAllRequested = q === '1' || q === 'true' || q === 'yes';
    const role = req.user?.role || '';
    const data = await partyService.listPartiesForUser({ role, includeAllRequested });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function createPartyController(req, res, next) {
  try {
    const data = await partyService.createParty(req.body || {}, buildAuditContext(req));
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function updatePartyController(req, res, next) {
  try {
    const { partyId } = req.params;
    const data = await partyService.updateParty(partyId, req.body || {}, buildAuditContext(req));
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function listCargoProfilesController(req, res, next) {
  try {
    const data = await shipmentRepository.listCargoProfilesForSelect();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listPortsController,
  createPortController,
  updatePortController,
  deletePortController,
  listPartiesController,
  createPartyController,
  updatePartyController,
  listCargoProfilesController,
};
