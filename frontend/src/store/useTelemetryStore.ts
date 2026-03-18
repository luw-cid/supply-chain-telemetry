import { create } from 'zustand'
import { shipmentMocks } from '../mock/shipments'
import type { Shipment, TelemetryPoint } from '../types'

interface TelemetryState {
  shipments: Shipment[]
  cursorByShipmentId: Record<string, number>
  selectedShipmentId: string
  simulationRunning: boolean
  setSelectedShipment: (shipmentId: string) => void
  advanceSimulation: () => void
  startSimulation: () => void
}

const initialCursor = shipmentMocks.reduce<Record<string, number>>((acc, shipment) => {
  acc[shipment.id] = 0
  return acc
}, {})

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  shipments: shipmentMocks,
  cursorByShipmentId: initialCursor,
  selectedShipmentId: shipmentMocks[0]?.id ?? '',
  simulationRunning: false,
  setSelectedShipment: (shipmentId) => set({ selectedShipmentId: shipmentId }),
  advanceSimulation: () => {
    const { shipments, cursorByShipmentId } = get()
    const nextCursor = { ...cursorByShipmentId }

    shipments.forEach((shipment) => {
      const current = nextCursor[shipment.id] ?? 0
      const lastIdx = shipment.routePoints.length - 1
      nextCursor[shipment.id] = current >= lastIdx ? 0 : current + 1
    })

    set({ cursorByShipmentId: nextCursor })
  },
  startSimulation: () => {
    if (get().simulationRunning) {
      return
    }

    set({ simulationRunning: true })
    window.setInterval(() => {
      get().advanceSimulation()
    }, 4500)
  },
}))

export const selectShipmentById = (shipments: Shipment[], shipmentId: string) =>
  shipments.find((shipment) => shipment.id === shipmentId)

export const getCurrentTelemetryPoint = (
  shipment: Shipment,
  cursorByShipmentId: Record<string, number>,
): TelemetryPoint => {
  const index = cursorByShipmentId[shipment.id] ?? 0
  return shipment.routePoints[index] ?? shipment.routePoints[0]
}

export const getTelemetryUntilCursor = (
  shipment: Shipment,
  cursorByShipmentId: Record<string, number>,
): TelemetryPoint[] => {
  const index = cursorByShipmentId[shipment.id] ?? 0
  return shipment.routePoints.slice(0, index + 1)
}
