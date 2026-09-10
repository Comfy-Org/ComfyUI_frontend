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
import type { ISlotType } from '@/lib/litegraph/src/interfaces'
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
 * projection must never depend on adapter internals (ADR-GRAPH-DOCUMENT-0024's seam).
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
  return { ...payload, id: toNodeId(id), type }
}

function isSlotRecord(
  value: unknown
): value is Record<string, unknown> & { name: string; type: ISlotType } {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string' &&
    (typeof record.type === 'string' || typeof record.type === 'number')
  )
}

function readNodeSlots<TKey extends 'inputs' | 'outputs'>(
  doc: Y.Doc,
  id: string,
  key: TKey
): SemanticLinkPayload[TKey extends 'inputs'
  ? 'targetInputs'
  : 'originOutputs'] {
  type Slots = SemanticLinkPayload[TKey extends 'inputs'
    ? 'targetInputs'
    : 'originOutputs']
  const value = nodesMap(doc).get(id)?.get(key)
  if (!(value instanceof Y.Array)) return [] as Slots
  const slots: unknown = value.toJSON()
  if (!Array.isArray(slots) || !slots.every(isSlotRecord)) return [] as Slots
  return slots
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

/**
 * Numeric keys ascend numerically; anything else follows them in code-unit
 * order. `Number(key)` alone yields `NaN` for a non-numeric key, and a
 * comparator returning `NaN` leaves the order implementation-defined.
 */
function compareLinkKeys(left: string, right: string): number {
  const integerPattern = /^-?\d+$/
  const leftSeq = integerPattern.test(left) ? Number(left) : null
  const rightSeq = integerPattern.test(right) ? Number(right) : null
  if (leftSeq !== null && rightSeq !== null) return leftSeq - rightSeq
  if (leftSeq !== null) return -1
  if (rightSeq !== null) return 1
  return left < right ? -1 : left > right ? 1 : 0
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
 * A snapshot is authoritative for its own link set, so a slot may not carry a
 * reference the snapshot does not contain — that reference would survive into
 * the serialized document and outlive the link it names.
 */
function withKnownLinks(
  payload: SemanticNodePayload,
  knownLinkIds: ReadonlySet<number>
): SemanticNodePayload {
  const { inputs, outputs } = payload
  return {
    ...payload,
    ...(Array.isArray(outputs) && {
      outputs: outputs.map((slot) =>
        isSlotRecord(slot) && Array.isArray(slot.links)
          ? {
              ...slot,
              links: slot.links.filter(
                (linkId) =>
                  typeof linkId === 'number' && knownLinkIds.has(linkId)
              )
            }
          : slot
      )
    }),
    ...(Array.isArray(inputs) && {
      inputs: inputs.map((slot) =>
        isSlotRecord(slot) &&
        typeof slot.link === 'number' &&
        !knownLinkIds.has(slot.link)
          ? { ...slot, link: null }
          : slot
      )
    })
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
      const links = [...linksMap(stagedDoc).keys()]
        .sort(compareLinkKeys)
        .flatMap((id) => readSemanticLink(stagedDoc, id) ?? [])
      const knownLinkIds = new Set(links.map(({ id }) => id))
      return mutations.batch(frameContext(frame), (batch) => {
        batch.clearSemanticGraph()
        for (const id of nodeIds) {
          const payload = readSemanticNode(stagedDoc, id)
          if (payload)
            batch.reconcileNode(withKnownLinks(payload, knownLinkIds))
        }
        for (const link of links) batch.connect(link)
      })
    }
  }
}
