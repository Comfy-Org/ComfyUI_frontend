import type { MissingNodeType } from '@/types/comfy'

/**
 * Background applied to error rows/cards that belong to the canvas
 * selection. Uses the design-system selection blue so panel emphasis
 * matches the canvas selection color in both themes. The negative margin
 * and matching padding cancel out, so text never shifts — the background
 * simply bleeds 6px past the content for breathing room.
 */
export const SELECTION_EMPHASIS_CLASS =
  'rounded-sm bg-blue-selection -mx-1.5 px-1.5'

/**
 * Applied unconditionally to emphasizable elements so the emphasis
 * animates in both directions. Margin and padding interpolate in lockstep,
 * keeping text stationary while the background expands/contracts.
 */
export const SELECTION_EMPHASIS_TRANSITION_CLASS =
  'transition-[background-color,margin,padding] duration-200'

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
