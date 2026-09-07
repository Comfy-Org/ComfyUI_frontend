import type { NodeId } from '@/types/nodeId'

import type { ResolvedRoles } from './resolveTourRoles'
import type { TourMediaKind } from './tourRolePins'

export type TourStep =
  | { kind: 'upload'; nodeId: NodeId }
  | { kind: 'prompt'; nodeId: NodeId }
  | { kind: 'run' }
  | { kind: 'result'; nodeId: NodeId; mediaKind: TourMediaKind }

/** A role that did not resolve omits its step; Run targets the toolbar, not the graph. */
export function sequenceBuilder({
  source,
  promptHost,
  sink,
  mediaKind
}: ResolvedRoles): TourStep[] {
  return [
    ...(source ? [{ kind: 'upload' as const, nodeId: source }] : []),
    ...(promptHost ? [{ kind: 'prompt' as const, nodeId: promptHost }] : []),
    { kind: 'run' as const },
    ...(sink ? [{ kind: 'result' as const, nodeId: sink, mediaKind }] : [])
  ]
}
