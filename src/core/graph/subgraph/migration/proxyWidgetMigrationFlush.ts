import {
  HOST_VALUE_HOLE,
  type PendingMigrationEntry
} from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { migratePreviewExposure } from '@/core/graph/subgraph/migration/migratePreviewExposure'
import { planProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanner'
import {
  appendHostQuarantine,
  makeQuarantineEntry
} from '@/core/graph/subgraph/migration/quarantineEntry'
import { repairPrimitiveFanout } from '@/core/graph/subgraph/migration/repairPrimitiveFanout'
import { repairValueWidget } from '@/core/graph/subgraph/migration/repairValueWidget'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import type { ProxyWidgetErrorQuarantineEntry } from '@/core/schemas/proxyWidgetQuarantineSchema'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'

export interface FlushProxyWidgetMigrationArgs {
  hostNode: SubgraphNode
  /** widgets_values from the host node at parse time. May be sparse. */
  hostWidgetValues?: readonly unknown[]
}

export interface FlushProxyWidgetMigrationResult {
  repaired: number
  primitiveRepaired: number
  previewMigrated: number
  quarantined: number
}

const EMPTY_RESULT: FlushProxyWidgetMigrationResult = {
  repaired: 0,
  primitiveRepaired: 0,
  previewMigrated: 0,
  quarantined: 0
}

function toLegacyTuple(
  source: PromotedWidgetSource
): SerializedProxyWidgetTuple {
  return source.disambiguatingSourceNodeId
    ? [
        source.sourceNodeId,
        source.sourceWidgetName,
        source.disambiguatingSourceNodeId
      ]
    : [source.sourceNodeId, source.sourceWidgetName]
}

function unwrapHostValue(
  hostValue: PendingMigrationEntry['hostValue']
): TWidgetValue | undefined {
  return hostValue === HOST_VALUE_HOLE ? undefined : (hostValue as TWidgetValue)
}

function quarantineFor(
  entry: PendingMigrationEntry,
  reason: ProxyWidgetErrorQuarantineEntry['reason']
): ProxyWidgetErrorQuarantineEntry {
  return makeQuarantineEntry({
    originalEntry: toLegacyTuple(entry.normalized),
    reason,
    hostValue: unwrapHostValue(entry.hostValue)
  })
}

/**
 * Forward-ratchet a host SubgraphNode's legacy `properties.proxyWidgets` into
 * canonical representations:
 *
 * - value-widget entries → linked SubgraphInput via {@link repairValueWidget};
 * - primitive-fanout cohorts → one SubgraphInput per primitive via
 *   {@link repairPrimitiveFanout};
 * - preview entries → host-scoped exposure via {@link migratePreviewExposure};
 * - unrepairable / quarantine plans → appended to
 *   `properties.proxyWidgetErrorQuarantine`.
 *
 * Idempotent: re-running flush over an already-migrated host produces no
 * mutations and no duplicates because (a) the planner classifies migrated
 * entries as `alreadyLinked` (a no-op apply), (b) preview/quarantine helpers
 * dedup, and (c) the legacy `properties.proxyWidgets` is removed once flush
 * succeeds so subsequent calls return early.
 */
export function flushProxyWidgetMigration(
  args: FlushProxyWidgetMigrationArgs
): FlushProxyWidgetMigrationResult {
  const { hostNode, hostWidgetValues } = args

  const plan = planProxyWidgetMigration({ hostNode, hostWidgetValues })
  if (plan.entries.length === 0) return EMPTY_RESULT

  const previewStore = usePreviewExposureStore()
  const quarantineToAppend: ProxyWidgetErrorQuarantineEntry[] = []
  const result: FlushProxyWidgetMigrationResult = { ...EMPTY_RESULT }

  // Group primitive-bypass entries per primitive node. Cohort flushed
  // all-or-nothing through repairPrimitiveFanout.
  const primitiveCohorts = new Map<NodeId, PendingMigrationEntry[]>()

  for (const entry of plan.entries) {
    const { plan: planEntry } = entry

    if (planEntry.kind === 'primitiveBypass') {
      const cohort = primitiveCohorts.get(planEntry.primitiveNodeId) ?? []
      cohort.push(entry)
      primitiveCohorts.set(planEntry.primitiveNodeId, cohort)
      continue
    }

    if (
      planEntry.kind === 'alreadyLinked' ||
      planEntry.kind === 'createSubgraphInput'
    ) {
      const repair = repairValueWidget({ hostNode, entry })
      if (repair.ok) {
        result.repaired += 1
      } else {
        quarantineToAppend.push(quarantineFor(entry, repair.reason))
      }
      continue
    }

    if (planEntry.kind === 'previewExposure') {
      const repair = migratePreviewExposure({
        hostNode,
        entry,
        store: previewStore
      })
      if (repair.ok) {
        result.previewMigrated += 1
      } else {
        quarantineToAppend.push(quarantineFor(entry, repair.reason))
      }
      continue
    }

    if (planEntry.kind === 'quarantine') {
      quarantineToAppend.push(quarantineFor(entry, planEntry.reason))
    }
  }

  for (const cohort of primitiveCohorts.values()) {
    const repair = repairPrimitiveFanout({ hostNode, cohort })
    if (repair.ok) {
      result.primitiveRepaired += 1
    } else {
      for (const entry of cohort) {
        quarantineToAppend.push(quarantineFor(entry, repair.reason))
      }
    }
  }

  if (quarantineToAppend.length > 0) {
    appendHostQuarantine(hostNode, quarantineToAppend)
    result.quarantined = quarantineToAppend.length
  }

  // Idempotency anchor: once entries have been processed, drop the legacy
  // payload so subsequent loads/configures take the no-op short-circuit.
  // Canonical state now lives on linked SubgraphInputs, the
  // PreviewExposureStore, and properties.proxyWidgetErrorQuarantine.
  delete hostNode.properties.proxyWidgets

  return result
}
