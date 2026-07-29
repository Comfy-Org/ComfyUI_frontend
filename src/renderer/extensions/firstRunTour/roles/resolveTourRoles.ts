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

function rootHost(node: LGraphNode | null, root: LGraph): LGraphNode | null {
  if (!node) return null
  if (node.graph === root) return node
  const executionId = getExecutionIdByNode(root, node)
  return executionId ? getRootParentNode(root, executionId) : null
}

function resolvePin(pin: RolePin | undefined, root: LGraph): NodeId | null {
  if (!pin) return null
  const node = resolveNode(pin.id, root)
  return node?.type === pin.type ? (rootHost(node, root)?.id ?? null) : null
}

export function resolveTourRoles(
  graph: LGraph,
  templateId?: string
): ResolvedRoles | null {
  if (templateId === undefined || !Object.hasOwn(TOUR_ROLE_PINS, templateId)) {
    const roles = heuristicRoles(graph)
    if (!roles) return null
    return {
      source: null,
      promptHost: rootHost(roles.prompt, graph)?.id ?? null,
      sink: rootHost(roles.sink, graph)?.id ?? null,
      mediaKind: roles.mediaKind
    }
  }
  const pins = TOUR_ROLE_PINS[templateId as SupportedTemplateId]
  return {
    source: resolvePin(pins.source, graph),
    promptHost: resolvePin(pins.prompt, graph),
    sink: resolvePin(pins.sink, graph),
    mediaKind: pins.sink.type === 'SaveVideo' ? 'video' : 'image'
  }
}
