import type { NodeId } from '@/renderer/core/layout/types'

export enum PresentationSource {
  Canvas = 'canvas',
  Vue = 'vue',
  Store = 'store',
  External = 'external'
}

export interface NodePresentationState {
  id: NodeId
  title: string
  mode: number
  shape?: number
  showAdvanced?: boolean
  color?: string
  bgcolor?: string
  flags: {
    collapsed?: boolean
    pinned?: boolean
    ghost?: boolean
  }
}

export type PresentationUpdate = Partial<Omit<NodePresentationState, 'id'>>

export interface PresentationChange {
  type: 'create' | 'update' | 'delete'
  nodeId: NodeId
  property?: string
  source: PresentationSource
  oldValue?: unknown
  newValue?: unknown
}
