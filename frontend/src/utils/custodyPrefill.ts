/** Party đang ACTIVE trong chuỗi ownership-history (DETAILED). */
export function activeCustodianPartyId(chain: Record<string, unknown>[]): string | undefined {
  const step = chain.find((c) => c.ownershipStatus === 'ACTIVE')
  const co = step?.currentOwner
  if (co && typeof co === 'object' && co !== null && 'partyId' in co) {
    const id = (co as { partyId?: string | null }).partyId
    if (id != null && String(id).trim() !== '') return String(id)
  }
  return undefined
}
