import type { Subgraph } from '@/lib/litegraph/src/types/entityRegistry'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'

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

const MAX_REPORTS_PER_SESSION = 5
let prunedLinkReports = 0
let notifyFailureReports = 0

/** Maps each link id to the serialized input names that referenced it. */
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

function isNodeEndpoint(id: NodeId, ioId: NodeId): boolean {
  return id !== UNASSIGNED_NODE_ID && id !== ioId
}

function isMissingNode(subgraph: Subgraph, id: NodeId, ioId: NodeId): boolean {
  return isNodeEndpoint(id, ioId) && !subgraph.getNodeById(id)
}

function isBoundarySlotOutOfRange(subgraph: Subgraph, link: LLink): boolean {
  const originOut =
    link.origin_id === SUBGRAPH_INPUT_ID &&
    !isSlotInRange(link.origin_slot, subgraph.inputs.length)
  const targetOut =
    link.target_id === SUBGRAPH_OUTPUT_ID &&
    !isSlotInRange(link.target_slot, subgraph.outputs.length)
  return originOut || targetOut
}

function mayLayOutInputsInGraphHooks(
  node: NonNullable<ReturnType<Subgraph['getNodeById']>>
): boolean {
  if (node.isSubgraphNode()) return false
  return Boolean(node.onGraphConfigured ?? node.onAfterGraphConfigured)
}

function hasLostTargetInput(
  subgraph: Subgraph,
  link: LLink,
  serialisedInputLinks: ReadonlyMap<LinkId, readonly string[]>
): boolean {
  const names = serialisedInputLinks.get(link.id)
  const node = subgraph.getNodeById(link.target_id)
  if (!names?.length || !node) return false
  if (isSlotInRange(link.target_slot, node.inputs.length)) return false
  if (mayLayOutInputsInGraphHooks(node)) return false

  const canStillHoldLink = node.inputs.some((input, slot) => {
    if (!names.includes(input.name)) return false
    const occupant = inputLinkId(subgraph, node.id, slot)
    return (
      occupant === undefined ||
      occupant === link.id ||
      !serialisedInputLinks.has(occupant)
    )
  })
  return !canStillHoldLink
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
  if (hasLostTargetInput(subgraph, link, serialisedInputLinks))
    return 'dropped_input'
}

function dropStaleBoundaryLinkIds(subgraph: Subgraph): void {
  for (const slot of [...subgraph.inputs, ...subgraph.outputs]) {
    const live = slot.linkIds.filter((id) => subgraph.links.has(id))
    slot.linkIds.splice(0, slot.linkIds.length, ...live)
  }
}

function notifySafely(link: LLink, notify: () => void): void {
  try {
    notify()
  } catch (error) {
    if (notifyFailureReports >= MAX_REPORTS_PER_SESSION) return
    notifyFailureReports++
    reportError(error, {
      surface: 'graph',
      errorType: 'error_notifying_pruned_subgraph_link',
      level: 'warning',
      context: { linkId: link.id }
    })
  }
}

function notifyEndpoints(
  connection: ReturnType<LLink['resolve']>,
  link: LLink
): void {
  const { outputNode, output, inputNode, input } = connection
  if (outputNode && output) {
    notifySafely(link, () =>
      outputNode.onConnectionsChange?.(
        NodeSlotType.OUTPUT,
        link.origin_slot,
        false,
        link,
        output
      )
    )
  }
  if (inputNode && input) {
    notifySafely(link, () =>
      inputNode.onConnectionsChange?.(
        NodeSlotType.INPUT,
        link.target_slot,
        false,
        link,
        input
      )
    )
  }
}

/** Deletes inner links of a configured subgraph that can never resolve. */
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
  dropStaleBoundaryLinkIds(subgraph)
  subgraph.incrementVersion()
  for (const { connection, link } of disconnected)
    notifyEndpoints(connection, link)

  if (prunedLinkReports >= MAX_REPORTS_PER_SESSION) return
  prunedLinkReports++
  reportError(new Error('Pruned unresolvable subgraph links on load'), {
    surface: 'graph',
    errorType: 'error_pruning_subgraph_link',
    level: 'warning',
    fingerprint: ['error_pruning_subgraph_link'],
    tags: counts,
    logToConsole: false
  })
}
