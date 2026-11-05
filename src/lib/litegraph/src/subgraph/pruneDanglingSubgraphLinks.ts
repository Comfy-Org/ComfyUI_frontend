import type { Subgraph } from '@comfyorg/graph-model/entityRegistry'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'
import type { LinkId } from '@comfyorg/graph-model/linkId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { reportError } from '@comfyorg/telemetry/reportError'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { inputLinkId } from '@/lib/litegraph/src/node/slotLinks'

import { isSlotInRange, isUnresolvableSubgraphLink } from './subgraphUtils'

type DanglingLinkKind =
  | 'origin_node_missing'
  | 'target_node_missing'
  | 'boundary_slot_out_of_range'
  | 'dropped_input'

/** Load-time reports per session; each one already aggregates a whole definition. */
const MAX_REPORTS = 5
let reportsSent = 0

/** Serialized input names on each link's target that named that link. */
export function captureSerialisedInputLinks(
  nodesData: readonly ISerialisedNode[] | undefined
): ReadonlyMap<LinkId, readonly string[]> {
  const namesByLinkId = new Map<LinkId, string[]>()
  for (const node of nodesData ?? []) {
    for (const input of node.inputs ?? []) {
      if (input.link == null) continue
      const linkId = toLinkId(input.link)
      const names = namesByLinkId.get(linkId) ?? []
      names.push(input.name)
      namesByLinkId.set(linkId, names)
    }
  }
  return namesByLinkId
}

const isNodeEndpoint = (id: NodeId, ioId: NodeId) =>
  id !== UNASSIGNED_NODE_ID && id !== ioId

/**
 * True when no live input of the link's target node could still hold it: none
 * carries a name the workflow saved for this link while being free, holding this
 * link, or holding a link the workflow never named. Realignment has already moved
 * every link it could; one left out of range with a free same-named input is a
 * failed move, not a drop, and stays for the unpack guard to refuse loudly.
 *
 * A node with graph-level configure hooks may lay out its inputs only there,
 * after this runs, so its links are never judged here. In the app every
 * registered node type gets an `onGraphConfigured` from the widget-inputs
 * extension, so in practice this judges subgraph nodes, whose inputs come from
 * their definition's boundary slots and are final at this point.
 */
function lostItsInput(
  subgraph: Subgraph,
  link: LLink,
  serialisedInputLinks: ReadonlyMap<LinkId, readonly string[]>
): boolean {
  const names = serialisedInputLinks.get(link.id)
  const node = subgraph.getNodeById(link.target_id)
  if (!names?.length || !node) return false
  if (
    !node.isSubgraphNode() &&
    (node.onGraphConfigured || node.onAfterGraphConfigured)
  )
    return false

  return !node.inputs.some((input, slot) => {
    if (!names.includes(input.name)) return false
    const occupant = inputLinkId(subgraph, node.id, slot)
    return (
      occupant === undefined ||
      occupant === link.id ||
      !serialisedInputLinks.has(occupant)
    )
  })
}

const isMissingNode = (subgraph: Subgraph, id: NodeId, ioId: NodeId) =>
  isNodeEndpoint(id, ioId) && !subgraph.getNodeById(id)

function isBoundarySlotOutOfRange(subgraph: Subgraph, link: LLink): boolean {
  const originOut =
    link.origin_id === SUBGRAPH_INPUT_ID &&
    !isSlotInRange(link.origin_slot, subgraph.inputs.length)
  const targetOut =
    link.target_id === SUBGRAPH_OUTPUT_ID &&
    !isSlotInRange(link.target_slot, subgraph.outputs.length)
  return originOut || targetOut
}

function classify(
  subgraph: Subgraph,
  link: LLink,
  serialisedInputLinks: ReadonlyMap<LinkId, readonly string[]>
): DanglingLinkKind | undefined {
  if (!isUnresolvableSubgraphLink(subgraph, link)) return
  if (isMissingNode(subgraph, link.origin_id, SUBGRAPH_INPUT_ID))
    return 'origin_node_missing'
  if (isMissingNode(subgraph, link.target_id, SUBGRAPH_OUTPUT_ID))
    return 'target_node_missing'
  if (isBoundarySlotOutOfRange(subgraph, link))
    return 'boundary_slot_out_of_range'
  if (lostItsInput(subgraph, link, serialisedInputLinks)) return 'dropped_input'
}

/**
 * `LLink.disconnect` does not maintain boundary `linkIds`, which are serialized:
 * a stale id would leave the slot reporting a wire that does not exist.
 */
function reconcileBoundarySlots(subgraph: Subgraph): void {
  for (const slot of [...subgraph.inputs, ...subgraph.outputs]) {
    const live = slot.linkIds.filter((id) => subgraph.links.has(id))
    slot.linkIds.splice(0, slot.linkIds.length, ...live)
  }
}

function notifyEndpoints(
  connection: ReturnType<LLink['resolve']>,
  link: LLink
): void {
  try {
    if (connection.outputNode && connection.output) {
      connection.outputNode.onConnectionsChange?.(
        NodeSlotType.OUTPUT,
        link.origin_slot,
        false,
        link,
        connection.output
      )
    }
    if (connection.inputNode && connection.input) {
      connection.inputNode.onConnectionsChange?.(
        NodeSlotType.INPUT,
        link.target_slot,
        false,
        link,
        connection.input
      )
    }
  } catch (error) {
    console.error(`Failed to notify pruned link ${link.id}`, error)
  }
}

/**
 * Deletes inner links that cannot resolve and never will: an endpoint node that
 * does not exist, a boundary slot index that does not exist, or a target input
 * the node no longer lays out (matched per link by its saved name). Each pruned
 * link is one the unpack guard already refuses, and one that makes prompt
 * building fail for the whole workflow.
 *
 * Output-side slot drift on an existing node is left alone: outputs are never
 * realigned by name, so a stale `origin_slot` cannot be told from a misroute.
 *
 * Runs after the definition's own configure, before graph-level
 * `onGraphConfigured`/`onAfterGraphConfigured` hooks, which is why nodes that
 * define those hooks are exempt from the dropped-input check.
 */
export function pruneDanglingSubgraphLinks(
  subgraph: Subgraph,
  serialisedInputLinks: ReadonlyMap<LinkId, readonly string[]>
): void {
  const pruned = [...subgraph.links.values()].flatMap((link) => {
    const kind = classify(subgraph, link, serialisedInputLinks)
    return kind ? [{ link, kind }] : []
  })
  if (!pruned.length) return

  const counts: Partial<Record<DanglingLinkKind, number>> = {}
  const disconnected = pruned.map(({ link, kind }) => {
    counts[kind] = (counts[kind] ?? 0) + 1
    console.warn('Dropping an unresolvable subgraph link', {
      kind,
      subgraphId: subgraph.id,
      linkId: link.id,
      originId: link.origin_id,
      originSlot: link.origin_slot,
      targetId: link.target_id,
      targetSlot: link.target_slot
    })
    const connection = link.resolve(subgraph)
    link.disconnect(subgraph)
    return { connection, link }
  })
  subgraph.incrementVersion()
  // Only once every pruned link is gone, so a callback that reshapes its node's
  // slots cannot change a link this pass has yet to remove.
  for (const { connection, link } of disconnected)
    notifyEndpoints(connection, link)
  reconcileBoundarySlots(subgraph)

  if (reportsSent >= MAX_REPORTS) return
  reportsSent++
  reportError(new Error('Pruned unresolvable subgraph links on load'), {
    surface: 'graph',
    errorType: 'subgraph_unresolvable_link',
    level: 'warning',
    fingerprint: ['subgraph_unresolvable_link'],
    tags: counts,
    logToConsole: false
  })
}
