import type { MissingNodeType } from '@/types/comfy'

/**
 * Background applied to error rows/cards that belong to the canvas
 * selection. Uses the design-system selection blue so panel emphasis
 * matches the canvas selection color in both themes.
 */
export const SELECTION_EMPHASIS_CLASS = 'rounded-sm bg-blue-selection'

/** True when any node type resolves to a node in the given id set. */
export function someNodeTypeInSelection(
  nodeTypes: MissingNodeType[],
  nodeIds: Set<string> | undefined
): boolean {
  if (!nodeIds?.size) return false
  return nodeTypes.some(
    (nodeType) =>
      typeof nodeType !== 'string' &&
      nodeType.nodeId != null &&
      nodeIds.has(String(nodeType.nodeId))
  )
}
