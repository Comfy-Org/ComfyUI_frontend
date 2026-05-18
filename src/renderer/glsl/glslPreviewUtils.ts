import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'

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

export function getImageThroughSubgraphBoundary(
  node: LGraphNode,
  slot: number,
  ownerSubgraphNode: LGraphNode
): HTMLImageElement | undefined {
  const graph = node.graph
  if (!graph) return undefined

  const input = node.inputs[slot]
  if (input?.link == null) return undefined

  const link = graph._links.get(input.link)
  if (!link || link.origin_id !== SUBGRAPH_INPUT_ID) return undefined

  const outerUpstream = ownerSubgraphNode.getInputNode(link.origin_slot)
  if (!outerUpstream?.imgs?.length) return undefined

  return outerUpstream.imgs[0]
}
