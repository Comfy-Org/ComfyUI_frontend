import { cn } from '@comfyorg/tailwind-utils'

import type { MissingNodeType } from '@/types/comfy'

// The negative margin and matching padding cancel out, so the background
// bleeds 6px past the content without shifting the text.
const EMPHASIS_CLASS = 'rounded-sm bg-blue-selection -mx-1.5 px-1.5'

// Present even when unhighlighted so the emphasis animates both ways.
const TRANSITION_CLASS =
  'transition-[background-color,margin,padding,border-radius] duration-200'

/** Classes emphasizing rows/cards that belong to the canvas selection. */
export function selectionEmphasisClass(highlighted: boolean | undefined) {
  return cn(TRANSITION_CLASS, highlighted && EMPHASIS_CLASS)
}

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
