import type { SelectorTarget } from '@/platform/onboarding/coachmarkRegistry'
import type { NodeId } from '@/types/nodeId'

/** A canvas node as a coachmark target; the engine follows it frame by frame. */
export function canvasNodeTarget(nodeId: NodeId): SelectorTarget {
  return { selector: `[data-node-id="${CSS.escape(String(nodeId))}"]` }
}
