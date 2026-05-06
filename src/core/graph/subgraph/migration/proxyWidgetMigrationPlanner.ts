import { classifyProxyEntry } from '@/core/graph/subgraph/migration/classifyProxyEntry'
import type {
  HostValue,
  PendingMigrationEntry,
  ProxyWidgetMigrationPlan
} from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { HOST_VALUE_HOLE } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { normalizeLegacyProxyWidgetEntry } from '@/core/graph/subgraph/legacyProxyWidgetNormalization'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { parseProxyWidgets } from '@/core/schemas/promotionSchema'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

export interface PlanProxyWidgetMigrationArgs {
  hostNode: SubgraphNode
  /** widgets_values from the host node at parse time. May be sparse. */
  hostWidgetValues?: readonly unknown[]
}

function pickHostValue(
  hostWidgetValues: readonly unknown[] | undefined,
  index: number
): HostValue {
  if (!hostWidgetValues) return HOST_VALUE_HOLE
  if (index < 0 || index >= hostWidgetValues.length) return HOST_VALUE_HOLE
  if (!Object.prototype.hasOwnProperty.call(hostWidgetValues, index)) {
    return HOST_VALUE_HOLE
  }
  return hostWidgetValues[index] as TWidgetValue
}

export function planProxyWidgetMigration(
  args: PlanProxyWidgetMigrationArgs
): ProxyWidgetMigrationPlan {
  const { hostNode, hostWidgetValues } = args

  const tuples = parseProxyWidgets(hostNode.properties.proxyWidgets)
  if (tuples.length === 0) return { entries: [] }

  const normalized: PromotedWidgetSource[] = tuples.map(
    ([sourceNodeId, sourceWidgetName, disambiguator]) =>
      normalizeLegacyProxyWidgetEntry(
        hostNode,
        sourceNodeId,
        sourceWidgetName,
        disambiguator
      )
  )

  const entries: PendingMigrationEntry[] = normalized.map(
    (entry, legacyOrderIndex) => {
      const { classification, plan } = classifyProxyEntry({
        hostNode,
        normalized: entry,
        cohort: normalized
      })
      return {
        normalized: entry,
        legacyOrderIndex,
        hostValue: pickHostValue(hostWidgetValues, legacyOrderIndex),
        classification,
        plan
      }
    }
  )

  entries.sort((a, b) => a.legacyOrderIndex - b.legacyOrderIndex)

  return { entries }
}
