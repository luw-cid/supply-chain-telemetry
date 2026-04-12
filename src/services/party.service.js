const AppError = require('../utils/app-error');
const auditRepository = require('../repositories/audit.repository');
const partyRepository = require('../repositories/party.repository');

const PARTY_TYPES = new Set(['OWNER', 'LOGISTICS', 'AUDITOR']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
const ROLES_FULL_LIST = new Set(['ADMIN', 'LOGISTICS', 'AUDITOR']);

function normalizePartyId(id) {
  if (id == null || typeof id !== 'string') return '';
  return id.trim();
}

function canSeeFullPartyList(role) {
  return ROLES_FULL_LIST.has(role);
}

async function listPartiesForUser({ role, includeAllRequested }) {
  const includeAll = includeAllRequested && canSeeFullPartyList(role);
  if (includeAll) {
    return partyRepository.listPartiesDetailed();
  }
  return partyRepository.listPartiesForSelect();
}

function pickPartyPayload(body) {
  return {
    partyType: (body.partyType ?? body.PartyType ?? '').toString().toUpperCase(),
    name: typeof body.name === 'string' ? body.name.trim() : typeof body.Name === 'string' ? body.Name.trim() : '',
    email:
      body.email !== undefined
        ? body.email === '' || body.email == null
          ? null
          : String(body.email).trim()
        : body.Email !== undefined
          ? body.Email === '' || body.Email == null
            ? null
            : String(body.Email).trim()
          : undefined,
    phone:
      body.phone !== undefined
        ? body.phone === '' || body.phone == null
          ? null
          : String(body.phone).trim()
        : body.Phone !== undefined
          ? body.Phone === '' || body.Phone == null
            ? null
            : String(body.Phone).trim()
          : undefined,
    address:
      body.address !== undefined
        ? body.address === '' || body.address == null
          ? null
          : String(body.address).trim()
        : body.Address !== undefined
          ? body.Address === '' || body.Address == null
            ? null
            : String(body.Address).trim()
          : undefined,
    status: (body.status ?? body.Status ?? 'ACTIVE').toString().toUpperCase(),
  };
}

function validatePartyType(t) {
  if (!PARTY_TYPES.has(t)) {
    throw AppError.badRequest(`PartyType must be one of: ${[...PARTY_TYPES].join(', ')}`);
  }
}

function validateStatus(s) {
  if (!STATUSES.has(s)) {
    throw AppError.badRequest(`Status must be one of: ${[...STATUSES].join(', ')}`);
  }
}

async function createParty(body, auditCtx) {
  const partyId = normalizePartyId(body.partyId ?? body.PartyID);
  if (!partyId || partyId.length > 32) {
    throw AppError.badRequest('PartyID is required and must be at most 32 characters');
  }

  const p = pickPartyPayload(body);
  if (p.partyType === '') throw AppError.badRequest('PartyType is required');
  validatePartyType(p.partyType);
  if (!p.name) throw AppError.badRequest('Name is required');
  validateStatus(p.status);

  const email = p.email === undefined ? null : p.email;
  const phone = p.phone === undefined ? null : p.phone;
  const address = p.address === undefined ? null : p.address;

  try {
    await partyRepository.insertParty({
      partyId,
      partyType: p.partyType,
      name: p.name,
      email,
      phone,
      address,
      status: p.status,
    });
  } catch (err) {
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
      throw AppError.conflict(`Party ${partyId} already exists`);
    }
    throw err;
  }

  const created = await partyRepository.findPartyById(partyId);
  await auditRepository.insertAuditLog({
    tableName: 'Parties',
    operation: 'INSERT',
    recordId: partyId,
    oldValue: null,
    newValue: created,
    changedBy: auditCtx.changedBy,
    clientIp: auditCtx.clientIp,
    userAgent: auditCtx.userAgent,
  });

  return created;
}

async function updateParty(partyIdParam, body, auditCtx) {
  const partyId = normalizePartyId(partyIdParam);
  const existing = await partyRepository.findPartyById(partyId);
  if (!existing) throw AppError.notFound(`Party ${partyId} not found`);

  const merged = {
    partyType: body.partyType ?? body.PartyType ?? existing.PartyType,
    name: body.name ?? body.Name ?? existing.Name,
    email: body.email !== undefined ? body.email : body.Email !== undefined ? body.Email : existing.Email,
    phone: body.phone !== undefined ? body.phone : body.Phone !== undefined ? body.Phone : existing.Phone,
    address: body.address !== undefined ? body.address : body.Address !== undefined ? body.Address : existing.Address,
    status: body.status ?? body.Status ?? existing.Status,
  };
  const p = pickPartyPayload(merged);
  validatePartyType(p.partyType);
  if (!p.name) throw AppError.badRequest('Name is required');
  validateStatus(p.status);

  const email = p.email === undefined ? existing.Email : p.email;
  const phone = p.phone === undefined ? existing.Phone : p.phone;
  const address = p.address === undefined ? existing.Address : p.address;

  const n = await partyRepository.updatePartyRow(partyId, {
    partyType: p.partyType,
    name: p.name,
    email,
    phone,
    address,
    status: p.status,
  });
  if (!n) throw AppError.notFound(`Party ${partyId} not found`);

  const updated = await partyRepository.findPartyById(partyId);
  await auditRepository.insertAuditLog({
    tableName: 'Parties',
    operation: 'UPDATE',
    recordId: partyId,
    oldValue: existing,
    newValue: updated,
    changedBy: auditCtx.changedBy,
    clientIp: auditCtx.clientIp,
    userAgent: auditCtx.userAgent,
  });

  return updated;
}

module.exports = {
  listPartiesForUser,
  createParty,
  updateParty,
};
