import type { CustodyEvent } from '../types'

function pickOwner(c: Record<string, unknown>): string {
  const co = c.currentOwner
  if (co && typeof co === 'object' && 'name' in co) return String((co as { name: string }).name)
  if (typeof co === 'string') return co
  if (c.CurrentOwner != null) return String(c.CurrentOwner)
  return '—'
}

function pickPort(c: Record<string, unknown>): string {
  const hp = c.handoverPort
  if (hp && typeof hp === 'object') {
    const o = hp as { name?: string; code?: string }
    return o.name || o.code || '—'
  }
  if (typeof hp === 'string') return hp
  if (c.HandoverPort != null) return String(c.HandoverPort)
  return '—'
}

function pickTime(c: Record<string, unknown>): string {
  const t = c.startAtUTC ?? c.StartAtUTC
  return t ? String(t) : new Date().toISOString()
}

function pickNote(c: Record<string, unknown>): string {
  const prev = c.previousOwner
  let prevStr = ''
  if (prev && typeof prev === 'object' && 'name' in prev) prevStr = `Từ ${(prev as { name: string }).name}`
  else if (typeof prev === 'string') prevStr = `Từ ${prev}`
  else if (c.previous_owner_name) prevStr = `Từ ${c.previous_owner_name}`

  const cond = c.handoverCondition ?? c.HandoverCondition ?? ''
  const notes = c.handoverNotes ?? c.HandoverNotes ?? ''
  return [prevStr, cond, notes].filter(Boolean).join(' · ') || '—'
}

export function mapOwnershipChainToEvents(chain: Record<string, unknown>[]): CustodyEvent[] {
  return chain.map((c) => ({
    time: pickTime(c),
    owner: pickOwner(c),
    port: pickPort(c),
    note: pickNote(c),
  }))
}
