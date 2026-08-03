import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import {
  getExecutionIdByNode,
  getRootParentNode
} from '@/utils/graphTraversalUtil'
import { resolveNode } from '@/utils/litegraphUtil'

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

/** The root-graph node a pin is spotlit through: itself, or the subgraph node holding it. */
function rootHost(node: LGraphNode, root: LGraph): LGraphNode | null {
  if (node.graph === root) return node
  const executionId = getExecutionIdByNode(root, node)
  return executionId ? getRootParentNode(root, executionId) : null
}

/** The pinned type is the guard: an id alone matches any graph that has it. */
function resolvePin(pin: RolePin | undefined, root: LGraph): NodeId | null {
  if (!pin) return null
  const node = resolveNode(pin.id, root)
  return node?.type === pin.type ? (rootHost(node, root)?.id ?? null) : null
}

/**
 * Validates a template's pins against the live graph. A template the tour does
 * not support gets no roles at all; a pin the graph no longer contains degrades
 * to null so its step is omitted rather than spotlighting a node that is gone.
 */
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
    mediaKind: pins.mediaKind
  }
}
