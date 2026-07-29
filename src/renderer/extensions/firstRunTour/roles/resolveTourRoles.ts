import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

import { TOUR_ROLE_PINS } from './tourRolePins'
import type {
  RolePin,
  SupportedTemplateId,
  TourMediaKind
} from './tourRolePins'

export interface ResolvedRoles {
  source: NodeId | null
  promptHost: NodeId | null
  sink: NodeId | null
  mediaKind: TourMediaKind
}

function resolvePin(pin: RolePin | undefined, graph: LGraph): NodeId | null {
  if (!pin) return null
  const node = graph.getNodeById(toNodeId(pin.id))
  return node?.type === pin.type ? node.id : null
}

export function resolveTourRoles(
  graph: LGraph,
  templateId: string
): ResolvedRoles | null {
  if (!Object.hasOwn(TOUR_ROLE_PINS, templateId)) return null
  const pins = TOUR_ROLE_PINS[templateId as SupportedTemplateId]
  return {
    source: resolvePin(pins.source, graph),
    promptHost: resolvePin(pins.prompt, graph),
    sink: resolvePin(pins.sink, graph),
    mediaKind: pins.sink.type === 'SaveVideo' ? 'video' : 'image'
  }
}
