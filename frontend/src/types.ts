export type ShipmentStatus = 'NORMAL' | 'VIOLATION' | 'ALARM'

export interface TelemetryPoint {
  lat: number
  lng: number
  temperature: number
  timestamp: string
  locationLabel: string
  status: ShipmentStatus
}

export interface CustodyEvent {
  time: string
  owner: string
  port: string
  note: string
}

export interface ShipmentEvent {
  key: string
  event: string
  time: string
  location: string
  actor: string
}

export interface Shipment {
  id: string
  containerCode: string
  currentPort: string
  currentOwner: string
  routePoints: TelemetryPoint[]
  custodyChain: CustodyEvent[]
  historyEvents: ShipmentEvent[]
}
