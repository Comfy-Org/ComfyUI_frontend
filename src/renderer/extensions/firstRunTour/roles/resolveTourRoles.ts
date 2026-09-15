import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import {
  getExecutionIdByNode,
  getRootParentNode
} from '@/utils/graphTraversalUtil'
import { resolveNode } from '@/utils/litegraphUtil'

import { heuristicRoles } from './heuristicRoles'
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

/** The root-graph node a role is spotlit through: itself, or the subgraph node holding it. */
function rootHost(
  node: LGraphNode | null | undefined,
  root: LGraph
): NodeId | null {
  if (!node) return null
  if (node.graph === root) return node.id
  const executionId = getExecutionIdByNode(root, node)
  return executionId ? (getRootParentNode(root, executionId)?.id ?? null) : null
}

/** The pinned type is the guard: an id alone matches any graph that has it. */
function resolvePin(pin: RolePin | undefined, root: LGraph): NodeId | null {
  if (!pin) return null
  const node = resolveNode(pin.id, root)
  return node?.type === pin.type ? rootHost(node, root) : null
}

/** Read off the graph itself, then host-mapped the same way pins are. */
function resolveFromGraph(graph: LGraph): ResolvedRoles | null {
  const roles = heuristicRoles(graph)
  if (!roles) return null

  return {
    source: rootHost(roles.source, graph),
    promptHost: rootHost(roles.prompt, graph),
    sink: rootHost(roles.sink, graph),
    mediaKind: roles.mediaKind
  }
}

/**
 * Validates a template's pins against the live graph, falling back to reading
 * the roles off the graph for anything unpinned — a shared workflow, or a
 * template URL nobody curated. A pin the graph no longer contains degrades to
 * null so its step is omitted rather than spotlighting a node that is gone.
 */
export function resolveTourRoles(
  graph: LGraph,
  templateId?: string
): ResolvedRoles | null {
  if (templateId === undefined || !Object.hasOwn(TOUR_ROLE_PINS, templateId))
    return resolveFromGraph(graph)
  const pins = TOUR_ROLE_PINS[templateId as SupportedTemplateId]

  return {
    source: resolvePin(pins.source, graph),
    promptHost: resolvePin(pins.prompt, graph),
    sink: resolvePin(pins.sink, graph),
    mediaKind: pins.mediaKind
  }
}
