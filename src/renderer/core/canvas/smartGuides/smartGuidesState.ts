import { shallowRef } from 'vue'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { SmartGuide } from './snapSolver'

/** Smart guide preferences, mirrored from settings by `useSmartGuidesSettings`. */
export const smartGuidesConfig = {
  enabled: true,
  edges: true,
  wires: true,
  spacing: true,
  distance: 8,
  gap: 0
}

/** Guides for the gesture in progress, in canvas units. */
export const activeGuides = shallowRef<readonly SmartGuide[]>([])

interface DistributeSession {
  graph: object
  axis: 'x' | 'y'
  nodeIds: NodeId[]
  selectionSize: number
}

/** Nodes left evenly spaced by the last distribute, whose gaps show drag handles. */
export const distributeSession = shallowRef<DistributeSession | null>(null)
