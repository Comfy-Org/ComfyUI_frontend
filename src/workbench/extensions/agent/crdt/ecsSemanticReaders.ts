import { nodesMap, OPAQUE_WIDGETS_KEY } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { SemanticLinkPayload, SemanticNodePayload } from './graphMutations'
import {
  isIncompatibleLinkType,
  prepareInputSlots,
  prepareOutputSlots
} from './graphMutations'
import type {
  ISerialisableNodeInput,
  ISerialisableNodeOutput
} from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'

import {
  hostInputs,
  hostSlotIndex,
  promotedWidgetNames
} from './agentSubgraphHostSlots'
import type { SubgraphDefinitionIndex } from './agentSubgraphHostSlots'
import {
  linkWireType,
  readLinkTuple,
  resolveLinkId,
  resolveLinkMapKey
} from './linkTuple'

export function plain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array) return value.toJSON()
  return structuredClone(value)
}

/**
 * Doc/live drift (an opaque widget array of the wrong length, a link onto an
 * undeclared promoted slot) persists in the doc, so every later frame that
 * re-reads the same entry would report it again. Report each distinct drift
 * once per target session; the set lives as long as the session does.
 */
export function reportOnce(
  reported: Set<string>,
  key: string,
  error: Error,
  options: Parameters<typeof reportError>[1]
): void {
  if (reported.has(key)) return
  reported.add(key)
  reportError(error, options)
}

/**
 * Reads a node's doc entry as a semantic payload. A SubgraphNode host (a node
 * whose type names a definition) is stored opaquely by cmp: positional widget
 * values under `__widgets_opaque` and only the grown slots under `inputs`.
 * Both are re-keyed from the definition so `reconcileNode` registers the
 * host's widgets under their promoted names and keeps its full slot list;
 * otherwise a reconcile would wipe the promoted widgets and `setWidget` by
 * name could never find them again.
 */
export function readSemanticNode(
  doc: Y.Doc,
  id: string,
  definitions: () => SubgraphDefinitionIndex,
  reported: Set<string>
): SemanticNodePayload | null {
  const source = nodesMap(doc).get(id)
  if (!(source instanceof Y.Map)) return null
  const type = source.get('type')
  if (typeof type !== 'string' || type.length === 0) return null

  const payload: SemanticNodePayload = { id, type }
  source.forEach((value, key) => {
    if (key === 'id' || key === 'type') return
    if (key === 'widgets' && value instanceof Y.Map) {
      payload.widgets_values = value.toJSON()
    } else if (key === OPAQUE_WIDGETS_KEY) {
      payload.widgets_values = plain(value)
    } else {
      payload[key] = plain(value)
    }
  })

  const definition = definitions().get(type)
  if (definition) {
    const opaque = payload.widgets_values
    if (Array.isArray(opaque)) {
      const names = promotedWidgetNames(definition, definitions())
      if (opaque.length === names.length) {
        payload.widgets_values = Object.fromEntries(
          opaque.map((value, index) => [names[index], value])
        )
      } else {
        // cmp writes the whole positional array against the same promoted
        // list (`promoted_inputs()`), so a length mismatch means the writer
        // and this reader disagree on the host surface. Mapping positionally
        // would land values on the wrong promoted widget; keep the live
        // values and surface the drift instead.
        delete payload.widgets_values
        reportOnce(
          reported,
          `widgets:${id}:${names.length}:${opaque.length}`,
          new Error(
            `Subgraph host ${id} (${type}) carries ${opaque.length} opaque widget values but its definition promotes ${names.length}`
          ),
          {
            errorType: 'error_reconciling_agent_subgraph_host_widgets',
            context: {
              nodeId: id,
              type,
              expected: names.length,
              actual: opaque.length
            }
          }
        )
      }
    }
    const docInputs = source.get('inputs')
    payload.inputs = hostInputs(
      definition,
      docInputs instanceof Y.Array ? docInputs.toJSON() : []
    )
  }
  return payload
}

function readNodeSlots(
  doc: Y.Doc,
  id: string,
  key: 'inputs'
): readonly ISerialisableNodeInput[]
function readNodeSlots(
  doc: Y.Doc,
  id: string,
  key: 'outputs'
): readonly ISerialisableNodeOutput[]
function readNodeSlots(
  doc: Y.Doc,
  id: string,
  key: 'inputs' | 'outputs'
): readonly ISerialisableNodeInput[] | readonly ISerialisableNodeOutput[] {
  const value = nodesMap(doc).get(id)?.get(key)
  const slots = value instanceof Y.Array ? value.toJSON() : []
  return key === 'inputs' ? prepareInputSlots(slots) : prepareOutputSlots(slots)
}

function reportInvalidHostTarget(
  reported: Set<string>,
  targetId: string,
  type: unknown,
  docSlot: number,
  name: string | undefined
): void {
  const displayName = name == null ? 'unnamed' : `'${name}'`
  reportOnce(
    reported,
    `slot:${targetId}:${docSlot}:${name ?? ''}`,
    new Error(
      `Subgraph host ${targetId} (${String(type)}) link targets doc slot ${docSlot} (${displayName}), which its definition does not declare unambiguously`
    ),
    {
      errorType: 'error_reconciling_agent_subgraph_host_slot',
      context: { nodeId: targetId, type, slot: docSlot, name: name ?? null }
    }
  )
}

/**
 * Resolves a link whose target is a SubgraphNode host. cmp only writes the
 * grown slot into the host's doc `inputs`, and its `target_slot` indexes that
 * doc-local list. The live host orders its inputs by the subgraph definition,
 * so re-derive both the slot index and the full input list from it.
 *
 * Returns `null` when the doc slot names an input the definition does not
 * declare (cmp's `claimPromotedInput` does not validate the grown name). The
 * live host has no such slot, so wiring the link positionally would land it
 * on an unrelated input; the caller skips the link instead and the drop is
 * reported so the doc/live divergence is visible.
 */
function hostTarget(
  doc: Y.Doc,
  definitions: SubgraphDefinitionIndex,
  reported: Set<string>,
  targetId: string,
  docSlot: number
): Pick<SemanticLinkPayload, 'targetSlot' | 'targetInputs'> | null {
  const docInputs = readNodeSlots(doc, targetId, 'inputs')
  const type = nodesMap(doc).get(targetId)?.get('type')
  const definition =
    typeof type === 'string' ? definitions.get(type) : undefined
  if (!definition) return { targetSlot: docSlot, targetInputs: docInputs }

  const name = docInputs.at(docSlot)?.name
  const slot = name == null ? -1 : hostSlotIndex(definition, name)
  if (slot < 0) {
    reportInvalidHostTarget(reported, targetId, type, docSlot, name)
    return null
  }
  return {
    targetSlot: slot,
    targetInputs: hostInputs(definition, docInputs)
  }
}

/**
 * The scalar fields a link tuple must carry, parsed and integer-validated.
 * `insert_workflow` mints a derived, non-numeric doc id for some inserted
 * entities, so a link's own tuple id and its doc map key are cross-checked
 * against each other; either diverging or failing to parse retires the link
 * instead of materializing something inconsistent.
 */
function parseLinkScalarFields(
  tuple: readonly unknown[],
  id: string
): { linkId: number; originSlot: number; targetSlot: number } | null {
  const linkId = resolveLinkId(tuple[0])
  const mapLinkId = resolveLinkMapKey(id)
  const originSlot = Number(tuple[2])
  const targetSlot = Number(tuple[4])
  if (
    linkId === null ||
    mapLinkId !== linkId ||
    tuple[1] == null ||
    tuple[3] == null ||
    !Number.isInteger(originSlot) ||
    !Number.isInteger(targetSlot)
  ) {
    return null
  }
  return { linkId, originSlot, targetSlot }
}

export function readSemanticLink(
  doc: Y.Doc,
  id: string,
  definitions: SubgraphDefinitionIndex,
  reported: Set<string>
): SemanticLinkPayload | null {
  const tuple = readLinkTuple(doc, id)
  if (!tuple || tuple.length < 5) return null
  const fields = parseLinkScalarFields(tuple, id)
  if (!fields) return null
  const { linkId, originSlot, targetSlot } = fields
  const targetNodeId = String(tuple[3])
  const target = hostTarget(
    doc,
    definitions,
    reported,
    targetNodeId,
    targetSlot
  )
  if (!target) return null
  return {
    id: linkId,
    originNodeId: String(tuple[1]),
    originSlot,
    targetNodeId,
    type: linkWireType(tuple),
    originOutputs: readNodeSlots(doc, String(tuple[1]), 'outputs'),
    ...target
  }
}

/**
 * Drops any link whose declared origin/target types `connect` would refuse.
 * `GraphMutations.batch` validates a whole batch atomically (by design —
 * see the "validates the whole plan before committing any writes" tests in
 * graphMutations.test.ts), so replaying every retained link unconditionally
 * during reconciliation means a single incompatible link already sitting in
 * the host-owned document — written before this type check existed, or by
 * any other path that bypassed it — would fail the SAME `connect` every
 * time reconciliation re-reads it, taking every other node/link/widget
 * queued in that batch down with it. Because a failed batch also re-arms
 * `reconcileNextFrame`, the next frame replays the identical bad link and
 * fails again, forever: no later valid mutation can ever land while that
 * one link remains.
 *
 * This never rewrites the shared document to "recover" — the excluded
 * link's doc entry is untouched, so it stays there exactly as before. It
 * only keeps this follower from materializing that one link into the local
 * canvas mirror, which is enough for the rest of the batch (every other
 * retained node and link, plus any new mutation queued in the same frame)
 * to validate and commit normally.
 */
export function excludeIncompatibleLinks(
  links: readonly SemanticLinkPayload[],
  reported: Set<string>
): SemanticLinkPayload[] {
  return links.filter((link) => {
    if (!isIncompatibleLinkType(link)) return true
    reportOnce(
      reported,
      `link-type:${link.id}`,
      new Error(
        `Link ${link.id} (node ${link.originNodeId} slot ${link.originSlot} -> node ${link.targetNodeId} slot ${link.targetSlot}) has an incompatible origin/target type and will not be projected`
      ),
      {
        errorType: 'error_reconciling_agent_incompatible_link_type',
        context: {
          linkId: link.id,
          originNodeId: link.originNodeId,
          originSlot: link.originSlot,
          targetNodeId: link.targetNodeId,
          targetSlot: link.targetSlot
        }
      }
    )
    return false
  })
}
