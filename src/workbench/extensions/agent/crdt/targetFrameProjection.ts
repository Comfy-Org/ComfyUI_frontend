import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type {
  TargetFrame,
  TargetFrameApplyPort
} from '@/core/graph/document/detachedTargetSession'
import type {
  GraphMutations,
  SemanticLinkPayload,
  SemanticNodePayload
} from '@/core/graph/graphMutations'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { compareNodeIds, toNodeId } from '@/types/nodeId'

function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

/**
 * Staged-doc counterpart of the adapter's live readers: the adapter reads
 * incremental observer effects off its bound follower doc, while this reads
 * whole snapshots off a detached session's staged doc. Kept local because the
 * projection must never depend on adapter internals (ADR-0024's seam).
 */
function readSemanticNode(doc: Y.Doc, id: string): SemanticNodePayload | null {
  const source = nodesMap(doc).get(id)
  if (!(source instanceof Y.Map)) return null
  const type = source.get('type')
  if (typeof type !== 'string' || type.length === 0) return null

  const payload: Record<string, unknown> = {}
  source.forEach((value, key) => {
    if (key === 'widgets' && value instanceof Y.Map) {
      payload.widgets_values = value.toJSON()
    } else if (key === OPAQUE_WIDGETS_KEY) {
      payload.widgets_values = plain(value)
    } else {
      payload[key] = plain(value)
    }
  })
  payload.id = id
  payload.type = type
  return payload as SemanticNodePayload
}

function readNodeSlots<TKey extends 'inputs' | 'outputs'>(
  doc: Y.Doc,
  id: string,
  key: TKey
): SemanticLinkPayload[TKey extends 'inputs'
  ? 'targetInputs'
  : 'originOutputs'] {
  const value = nodesMap(doc).get(id)?.get(key)
  return (
    value instanceof Y.Array ? value.toJSON() : []
  ) as SemanticLinkPayload[TKey extends 'inputs'
    ? 'targetInputs'
    : 'originOutputs']
}

function readSemanticLink(doc: Y.Doc, id: string): SemanticLinkPayload | null {
  const raw = linksMap(doc).get(id)
  const tuple = raw instanceof Y.Array ? raw.toArray() : raw
  if (!Array.isArray(tuple) || tuple.length < 5) return null
  const linkId = Number(tuple[0] ?? id)
  const originSlot = Number(tuple[2])
  const targetSlot = Number(tuple[4])
  if (
    !Number.isInteger(linkId) ||
    tuple[1] == null ||
    tuple[3] == null ||
    !Number.isInteger(originSlot) ||
    !Number.isInteger(targetSlot)
  ) {
    return null
  }
  return {
    id: linkId,
    originNodeId: String(tuple[1]),
    originSlot,
    targetNodeId: String(tuple[3]),
    targetSlot,
    type:
      typeof tuple[5] === 'string' || typeof tuple[5] === 'number'
        ? tuple[5]
        : '*',
    originOutputs: readNodeSlots(doc, String(tuple[1]), 'outputs'),
    targetInputs: readNodeSlots(doc, String(tuple[3]), 'inputs')
  }
}

function frameContext(frame: TargetFrame): RemoteMutationContext {
  const opIds = frame.opIds?.filter((id) => id.length > 0)
  return {
    source: 'agent-remote',
    actor: frame.actor ?? 'agent-replay',
    opId: opIds?.at(-1) ?? 'replay',
    ...(opIds && opIds.length > 0 && { opIds: [...opIds] })
  }
}

/**
 * Full-snapshot projection of a detached target session's staged document
 * into the ECS stores through the target's `GraphMutations` composite. One
 * atomic batch clears the scope and rebuilds it from the staged doc, so a
 * validation failure anywhere leaves the stores untouched and the frame
 * queued (the session's all-or-nothing commit contract).
 */
export function createTargetFrameApplyPort(
  mutations: GraphMutations
): TargetFrameApplyPort {
  return {
    apply(frame, stagedDoc) {
      const nodeIds = [...nodesMap(stagedDoc).keys()].sort((left, right) =>
        compareNodeIds(toNodeId(left), toNodeId(right))
      )
      const linkIds = [...linksMap(stagedDoc).keys()].sort(
        (left, right) => Number(left) - Number(right)
      )
      return mutations.batch(frameContext(frame), (batch) => {
        batch.clearSemanticGraph()
        for (const id of nodeIds) {
          const payload = readSemanticNode(stagedDoc, id)
          if (payload) batch.reconcileNode(payload)
        }
        for (const id of linkIds) {
          const link = readSemanticLink(stagedDoc, id)
          if (link) batch.connect(link)
        }
      })
    }
  }
}
