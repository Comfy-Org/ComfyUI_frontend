import type { PendingMigrationEntry } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { HOST_VALUE_HOLE } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { ProxyWidgetQuarantineReason } from '@/core/schemas/proxyWidgetQuarantineSchema'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'

export type RepairValueWidgetResult =
  | { ok: true; subgraphInputName: string }
  | { ok: false; reason: ProxyWidgetQuarantineReason }

interface RepairValueWidgetArgs {
  hostNode: SubgraphNode
  entry: PendingMigrationEntry
}

function findHostInputForLinkedSource(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string
) {
  return hostNode.inputs.find((input) => {
    const widget = input._widget
    if (!widget || !isPromotedWidgetView(widget)) return false
    return (
      widget.sourceNodeId === sourceNodeId &&
      widget.sourceWidgetName === sourceWidgetName
    )
  })
}

function applyHostValue(
  widget: IBaseWidget,
  hostValue: PendingMigrationEntry['hostValue']
): void {
  if (hostValue === HOST_VALUE_HOLE) return
  widget.value = hostValue as TWidgetValue
}

function repairAlreadyLinked(
  hostNode: SubgraphNode,
  entry: PendingMigrationEntry
): RepairValueWidgetResult {
  const hostInput = findHostInputForLinkedSource(
    hostNode,
    entry.normalized.sourceNodeId,
    entry.normalized.sourceWidgetName
  )
  if (!hostInput?._widget) {
    return { ok: false, reason: 'missingSubgraphInput' }
  }

  applyHostValue(hostInput._widget, entry.hostValue)
  return { ok: true, subgraphInputName: hostInput.name }
}

function repairCreateSubgraphInput(
  hostNode: SubgraphNode,
  entry: PendingMigrationEntry,
  sourceWidgetName: string
): RepairValueWidgetResult {
  const subgraph = hostNode.subgraph
  const sourceNode: LGraphNode | null = subgraph.getNodeById(
    entry.normalized.sourceNodeId
  )
  if (!sourceNode) {
    return { ok: false, reason: 'missingSourceNode' }
  }

  const sourceWidget = sourceNode.widgets?.find(
    (w) => w.name === sourceWidgetName
  )
  if (!sourceWidget) {
    return { ok: false, reason: 'missingSourceWidget' }
  }

  const slot: INodeInputSlot | undefined =
    sourceNode.getSlotFromWidget(sourceWidget)
  if (!slot) {
    // TODO(adr-0009): When the source widget has no backing input slot,
    // promotion currently has no canonical path to wire it through a
    // SubgraphInput without first synthesizing the slot. The wiring slice
    // (slice 5) will reconcile this — for now we surface a quarantine reason
    // so the entry is preserved and visible to the user.
    console.warn(
      '[repairValueWidget] source widget has no backing input slot; quarantining',
      {
        sourceNodeId: entry.normalized.sourceNodeId,
        sourceWidgetName
      }
    )
    return { ok: false, reason: 'missingSubgraphInput' }
  }

  const existingNames = subgraph.inputs.map((input) => input.name)
  const desiredName = nextUniqueName(sourceWidgetName, existingNames)
  const slotType = String(slot.type ?? sourceWidget.type ?? '*')

  const newSubgraphInput = subgraph.addInput(desiredName, slotType)
  const link = newSubgraphInput.connect(slot, sourceNode)
  if (!link) {
    subgraph.removeInput(newSubgraphInput)
    return { ok: false, reason: 'missingSubgraphInput' }
  }

  const hostInput = hostNode.inputs.find(
    (input) => input.name === newSubgraphInput.name
  )
  if (!hostInput?._widget) {
    return { ok: true, subgraphInputName: newSubgraphInput.name }
  }

  applyHostValue(hostInput._widget, entry.hostValue)
  return { ok: true, subgraphInputName: newSubgraphInput.name }
}

/**
 * Repair a single legacy proxy entry into its canonical linked SubgraphInput.
 *
 * Two valid plan kinds: `'alreadyLinked'` and `'createSubgraphInput'`. Any
 * other plan kind is a programmer error (caller bug) and throws. Failures
 * during repair return a quarantine reason; the caller is expected to
 * append the entry to the host's quarantine via `appendHostQuarantine`.
 */
export function repairValueWidget(
  args: RepairValueWidgetArgs
): RepairValueWidgetResult {
  const { hostNode, entry } = args
  const { plan } = entry

  if (plan.kind === 'alreadyLinked') {
    return repairAlreadyLinked(hostNode, entry)
  }

  if (plan.kind === 'createSubgraphInput') {
    return repairCreateSubgraphInput(hostNode, entry, plan.sourceWidgetName)
  }

  throw new Error(`repairValueWidget: invalid plan kind ${plan.kind}`)
}
