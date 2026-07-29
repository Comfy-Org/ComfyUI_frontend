import type { RerouteId } from '@/types/rerouteId'

/** The input or output slot that an incomplete reroute link is connected to. */
export interface FloatingRerouteSlot {
  /** Floating connection to an input or output */
  slotType: 'input' | 'output'
}

/**
 * A reroute's chain state: its upstream neighbour and, on the last reroute
 * of a floating chain, which slot side the chain still faces. Link
 * membership is not stored — it is derived from the links' parentId chains.
 */
export interface RerouteChain {
  readonly id: RerouteId
  parentId?: RerouteId
  floating?: FloatingRerouteSlot
}
