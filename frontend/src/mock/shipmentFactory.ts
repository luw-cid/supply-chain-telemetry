import type { Shipment } from '../types'

export interface ShipmentFormValues {
  shipmentId: string
  containerCode: string
  currentOwner: string
  originLabel: string
  destinationLabel: string
}

/** Minimal two-leg route + single custody event; matches mock shipment shape. */
export function buildShipmentFromForm(values: ShipmentFormValues): Shipment {
  const id = values.shipmentId.trim()
  const containerCode = values.containerCode.trim()
  const currentOwner = values.currentOwner.trim()
  const originLabel = values.originLabel.trim()
  const destinationLabel = values.destinationLabel.trim()
  const now = new Date()
  const t0 = now.toISOString()
  const t1 = new Date(now.getTime() + 3_600_000).toISOString()

  return {
    id,
    containerCode,
    currentPort: originLabel,
    currentOwner,
    routePoints: [
      {
        lat: 1.29,
        lng: 103.852,
        temperature: 4,
        timestamp: t0,
        locationLabel: originLabel,
        status: 'NORMAL',
      },
      {
        lat: 51.924,
        lng: 4.478,
        temperature: 4,
        timestamp: t1,
        locationLabel: destinationLabel,
        status: 'NORMAL',
      },
    ],
    custodyChain: [
      {
        time: t0,
        owner: currentOwner,
        port: originLabel,
        note: 'Custody established at origin.',
      },
    ],
    historyEvents: [
      {
        key: '1',
        event: 'Shipment registered',
        time: t0,
        location: originLabel,
        actor: 'Operator',
      },
    ],
  }
}
