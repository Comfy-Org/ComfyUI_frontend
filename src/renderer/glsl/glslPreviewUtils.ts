import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import { inputLink } from '@/lib/litegraph/src/node/slotLinks'

export const GLSL_NODE_TYPE = 'GLSLShader'
export const DEBOUNCE_MS = 50
export const DEFAULT_SIZE = 512
const MAX_PREVIEW_DIMENSION = 1024

export function normalizeDimension(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SIZE
  return parsed
}

export function clampResolution(w: number, h: number): [number, number] {
  const maxDim = Math.max(w, h)
  if (maxDim <= MAX_PREVIEW_DIMENSION) return [w, h]
  const scale = MAX_PREVIEW_DIMENSION / maxDim
  return [Math.round(w * scale), Math.round(h * scale)]
}

export function getInputNodeThroughSubgraphBoundary(
  node: LGraphNode,
  slot: number,
  ownerSubgraphNode: LGraphNode
): LGraphNode | null {
  const graph = node.graph
  if (!graph) return null

  const link = node.getInputLink(slot)
  if (!link || link.origin_id !== SUBGRAPH_INPUT_ID) return null

  const outerGraph = ownerSubgraphNode.graph
  if (!outerGraph) return null
  const outerLink = inputLink(
    outerGraph,
    ownerSubgraphNode.id,
    link.origin_slot
  )
  return outerLink ? outerGraph.getNodeById(outerLink.origin_id) : null
}
