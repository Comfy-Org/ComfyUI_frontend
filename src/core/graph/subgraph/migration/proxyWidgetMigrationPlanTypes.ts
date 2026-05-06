import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { ProxyWidgetQuarantineReason } from '@/core/schemas/proxyWidgetQuarantineSchema'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

/**
 * Sentinel marking a sparse hole in a `widgets_values` array. Distinct from
 * `undefined` so that an explicitly-stored `undefined` host value can still be
 * represented when needed.
 */
export const HOST_VALUE_HOLE = Symbol('proxyWidgetMigration.hostValueHole')
export type HostValueHole = typeof HOST_VALUE_HOLE

export type HostValue = TWidgetValue | HostValueHole

/**
 * High-level outcome of classifying a single legacy proxyWidget entry.
 *
 * Distinct from {@link MigrationPlanKind} because a single classification can
 * still produce different plans (e.g. `'value'` may resolve to either
 * `alreadyLinked` or `createSubgraphInput`).
 */
export type ProxyEntryClassification =
  | 'value'
  | 'preview'
  | 'primitiveFanout'
  | 'unknown'

export interface PrimitiveBypassTargetRef {
  targetNodeId: NodeId
  targetSlot: number
}

export type MigrationPlan =
  | { kind: 'alreadyLinked'; subgraphInputName: string }
  | { kind: 'createSubgraphInput'; sourceWidgetName: string }
  | {
      kind: 'primitiveBypass'
      primitiveNodeId: NodeId
      sourceWidgetName: string
      targets: readonly PrimitiveBypassTargetRef[]
    }
  | { kind: 'previewExposure'; sourcePreviewName: string }
  | { kind: 'quarantine'; reason: ProxyWidgetQuarantineReason }

export type MigrationPlanKind = MigrationPlan['kind']

/**
 * One pending migration entry produced by the planner.
 *
 * @remarks
 * This is the input to the flush step. The planner does not mutate the graph;
 * it walks legacy `properties.proxyWidgets` and `widgets_values`, classifies
 * each entry, and emits a {@link PendingMigrationEntry} describing what the
 * flush should do. Flush re-validates against the current graph before
 * applying mutations.
 */
export interface PendingMigrationEntry {
  normalized: PromotedWidgetSource
  legacyOrderIndex: number
  hostValue: HostValue
  classification: ProxyEntryClassification
  plan: MigrationPlan
}

/**
 * The full plan the planner returns for a single host SubgraphNode.
 *
 * Entries are ordered by `legacyOrderIndex` ascending. Idempotency: re-running
 * the planner over a host whose canonical state already represents an entry
 * yields a `'alreadyLinked'`/`'previewExposure'` plan that the flush step
 * treats as a no-op.
 */
export interface ProxyWidgetMigrationPlan {
  entries: readonly PendingMigrationEntry[]
}
