import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'
import { hasImageOutput } from '@/utils/litegraphUtil'

export const BATCH_IMAGES_NODE_TYPE = 'BatchImagesNode'

export interface BatchImagesSelection {
  /** The batch node to append to, when the selection names exactly one. */
  target: LGraphNode | undefined
  /** Image nodes to wire, ordered top-to-bottom, excluding those already feeding the target. */
  sources: LGraphNode[]
}

const isBatchImagesNode = (node: LGraphNode) =>
  node.type === BATCH_IMAGES_NODE_TYPE

const byPosition = (a: LGraphNode, b: LGraphNode) =>
  a.pos[1] - b.pos[1] || a.pos[0] - b.pos[0]

const idsFeeding = (target: LGraphNode): Set<NodeId> => {
  if (!target.graph) return new Set()
  const origins = target.inputs.map((_, slot) => target.getInputNode(slot))
  return new Set(origins.filter((node) => node !== null).map((node) => node.id))
}

/**
 * Splits a selection into the batch node to append to and the image nodes to
 * wire into it. The selection decides: exactly one batch node means append,
 * anything else means a new batch node, so nothing is mutated implicitly.
 */
export function resolveBatchImagesSelection(
  selection: Iterable<LGraphNode>
): BatchImagesSelection {
  const imageNodes = [...selection].filter(hasImageOutput).sort(byPosition)
  const batchNodes = imageNodes.filter(isBatchImagesNode)
  const target = batchNodes.length === 1 ? batchNodes[0] : undefined
  if (!target) return { target: undefined, sources: imageNodes }

  const alreadyFeeding = idsFeeding(target)
  return {
    target,
    sources: imageNodes.filter(
      (node) => node.id !== target.id && !alreadyFeeding.has(node.id)
    )
  }
}

export const canCreateBatch = ({ target, sources }: BatchImagesSelection) =>
  !target && sources.length > 1

export const canAppendToBatch = ({ target, sources }: BatchImagesSelection) =>
  !!target && sources.length > 0
