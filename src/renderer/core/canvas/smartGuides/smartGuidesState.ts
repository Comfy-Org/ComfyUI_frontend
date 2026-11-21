import { shallowRef } from 'vue'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph } from '@/lib/litegraph/src/litegraph'

import type { Axis, SmartGuide } from './snapSolver'

export const activeGuides = shallowRef<readonly SmartGuide[]>([])

interface DistributeSession {
  graph: LGraph
  axis: Axis
  lanes: NodeId[][]
  selectionSize: number
}

/** Lanes of nodes left evenly spaced by the last distribute, in order; their gaps show drag handles. */
export const distributeSession = shallowRef<DistributeSession | null>(null)
