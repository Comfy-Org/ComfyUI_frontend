import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { GraphScope } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'

import { isRecord } from './isRecord'
import { prepareInputSlots, prepareOutputSlots } from './slots'
import type {
  PreparedNode,
  SemanticLinkPayload,
  SemanticNodePayload
} from './types'
import { widgetEntries } from './widgets'

function cloneRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? structuredClone(value) : {}
}
function readPair(
  value: unknown,
  fallback: readonly [number, number]
): readonly [number, number] {
  if (!Array.isArray(value) || value.length < 2) return fallback
  const first = Number(value[0])
  const second = Number(value[1])
  return Number.isFinite(first) && Number.isFinite(second)
    ? [first, second]
    : fallback
}
function nodeAppearance(
  payload: SemanticNodePayload
): Partial<
  Pick<
    NodeState,
    'bgcolor' | 'boxcolor' | 'color' | 'resizable' | 'shape' | 'showAdvanced'
  >
> {
  return {
    ...(typeof payload.bgcolor === 'string' && { bgcolor: payload.bgcolor }),
    ...(typeof payload.boxcolor === 'string' && { boxcolor: payload.boxcolor }),
    ...(typeof payload.color === 'string' && { color: payload.color }),
    ...(typeof payload.resizable === 'boolean' && {
      resizable: payload.resizable
    }),
    ...(typeof payload.shape === 'number' && { shape: payload.shape }),
    ...(typeof payload.showAdvanced === 'boolean' && {
      showAdvanced: payload.showAdvanced
    })
  }
}
/** Remote payloads are open data: a named record counts only when record-shaped. */
function serialisationOf(payload: SemanticNodePayload): ISerialisedNode {
  const serialised = structuredClone(payload) as unknown as ISerialisedNode
  if (!isRecord(payload.widgets_values_named)) {
    delete serialised.widgets_values_named
  }
  return serialised
}
export function prepareNode(
  payload: SemanticNodePayload,
  scope: GraphScope,
  existing?: NodeState
): PreparedNode {
  const id = toNodeId(payload.id)
  const [x, y] = readPair(payload.pos, [0, 0])
  const [width, height] = readPair(payload.size, [270, 100])
  const mode = Number(payload.mode)
  const state: NodeState = {
    id,
    graphId: scope.owningGraphId,
    type: payload.type,
    title:
      typeof payload.title === 'string' && payload.title.length > 0
        ? payload.title
        : payload.type,
    flags: cloneRecord(payload.flags),
    inputs: prepareInputSlots(payload.inputs, existing?.inputs),
    outputs: prepareOutputSlots(payload.outputs),
    mode: Number.isInteger(mode) ? mode : 0,
    properties: cloneRecord(payload.properties) as NodeState['properties'],
    lastSerialization: serialisationOf(payload),
    ...nodeAppearance(payload)
  }
  return {
    state,
    widgets: widgetEntries(payload),
    widgetsAuthoritative:
      Array.isArray(payload.widgets_values) || isRecord(payload.widgets_values),
    layout: {
      position: { x, y },
      size: { width, height }
    }
  }
}
export function prepareTopology(
  payload: SemanticLinkPayload,
  scope: GraphScope
): LinkTopology {
  return {
    id: toLinkId(payload.id),
    graphId: scope.owningGraphId,
    originNodeId: toNodeId(payload.originNodeId),
    originSlot: payload.originSlot,
    targetNodeId: toNodeId(payload.targetNodeId),
    targetSlot: payload.targetSlot,
    type: payload.type
  }
}
