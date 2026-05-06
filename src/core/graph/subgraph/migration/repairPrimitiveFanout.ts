import { isEqual } from 'es-toolkit/compat'

import type {
  PendingMigrationEntry,
  PrimitiveBypassTargetRef
} from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import { HOST_VALUE_HOLE } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

export type RepairPrimitiveFanoutResult =
  | { ok: true; subgraphInputName: string; reconnectCount: number }
  | { ok: false; reason: 'primitiveBypassFailed' }

interface RepairPrimitiveFanoutArgs {
  hostNode: SubgraphNode
  /** All cohort entries whose plan is `primitiveBypass` for this primitive. */
  cohort: readonly PendingMigrationEntry[]
}

const PRIMITIVE_NODE_TYPE = 'PrimitiveNode'
const FAILED: RepairPrimitiveFanoutResult = {
  ok: false,
  reason: 'primitiveBypassFailed'
}

interface SnapshotLink {
  primitiveSlot: number
  targetNodeId: NodeId
  targetSlot: number
}

function fail(message: string, context?: unknown): RepairPrimitiveFanoutResult {
  console.warn(`[repairPrimitiveFanout] ${message}`, context)
  return FAILED
}

interface CohortValidationOk {
  ok: true
  primitiveNodeId: NodeId
  sourceWidgetName: string
  uniqueEntries: readonly PendingMigrationEntry[]
}

function validateCohort(
  cohort: readonly PendingMigrationEntry[]
): CohortValidationOk | { ok: false } {
  if (cohort.length === 0) return { ok: false }

  const first = cohort[0]
  if (first.plan.kind !== 'primitiveBypass') return { ok: false }

  const primitiveNodeId = first.plan.primitiveNodeId
  const sourceWidgetName = first.plan.sourceWidgetName

  for (const entry of cohort) {
    if (entry.plan.kind !== 'primitiveBypass') return { ok: false }
    if (entry.plan.primitiveNodeId !== primitiveNodeId) return { ok: false }
    if (entry.plan.sourceWidgetName !== sourceWidgetName) return { ok: false }
  }

  // Coalesce exact duplicates by `normalized`.
  const uniqueEntries: PendingMigrationEntry[] = []
  for (const entry of cohort) {
    if (
      !uniqueEntries.some((kept) => isEqual(kept.normalized, entry.normalized))
    ) {
      uniqueEntries.push(entry)
    }
  }

  return { ok: true, primitiveNodeId, sourceWidgetName, uniqueEntries }
}

function pickBaseName(
  primitiveNode: LGraphNode,
  sourceWidgetName: string
): string {
  // Heuristic: a user-renamed PrimitiveNode title differs from its default
  // 'PrimitiveNode' label. When unrenamed, fall back to the source widget name.
  if (primitiveNode.title && primitiveNode.title !== PRIMITIVE_NODE_TYPE) {
    return primitiveNode.title
  }
  return sourceWidgetName
}

function collectTargets(
  hostNode: SubgraphNode,
  primitiveNode: LGraphNode
): PrimitiveBypassTargetRef[] | undefined {
  const subgraph = hostNode.subgraph
  const output = primitiveNode.outputs?.[0]
  const linkIds = output?.links ?? []
  const targets: PrimitiveBypassTargetRef[] = []
  for (const linkId of linkIds) {
    const link = subgraph.links.get(linkId)
    if (!link) return undefined
    targets.push({
      targetNodeId: link.target_id,
      targetSlot: link.target_slot
    })
  }
  return targets
}

function snapshotLinksForRollback(
  hostNode: SubgraphNode,
  primitiveNode: LGraphNode
): SnapshotLink[] {
  const subgraph = hostNode.subgraph
  const output = primitiveNode.outputs?.[0]
  const linkIds = output?.links ?? []
  const snapshot: SnapshotLink[] = []
  for (const linkId of linkIds) {
    const link = subgraph.links.get(linkId)
    if (!link) continue
    snapshot.push({
      primitiveSlot: link.origin_slot,
      targetNodeId: link.target_id,
      targetSlot: link.target_slot
    })
  }
  return snapshot
}

function rollback(
  hostNode: SubgraphNode,
  primitiveNode: LGraphNode,
  newSubgraphInput: SubgraphInput | undefined,
  snapshot: readonly SnapshotLink[]
): void {
  if (newSubgraphInput) {
    try {
      hostNode.subgraph.removeInput(newSubgraphInput)
    } catch (e) {
      console.warn('[repairPrimitiveFanout] rollback removeInput failed', e)
    }
  }
  for (const link of snapshot) {
    const targetNode = hostNode.subgraph.getNodeById(link.targetNodeId)
    if (!targetNode) continue
    primitiveNode.connect(link.primitiveSlot, targetNode, link.targetSlot)
  }
}

function pickHostValue(
  uniqueEntries: readonly PendingMigrationEntry[]
): TWidgetValue | undefined {
  const ordered = [...uniqueEntries].sort(
    (a, b) => a.legacyOrderIndex - b.legacyOrderIndex
  )
  for (const entry of ordered) {
    if (entry.hostValue !== HOST_VALUE_HOLE) {
      return entry.hostValue as TWidgetValue
    }
  }
  return undefined
}

/**
 * All-or-quarantine repair of one primitive's fan-out into a single
 * SubgraphInput.
 *
 * Each call repairs ONE primitive node and the cohort of legacy entries that
 * pointed at it. On any failure during validation or mutation, the helper
 * rolls back any partial changes and returns
 * `{ ok: false, reason: 'primitiveBypassFailed' }` so the caller can
 * quarantine all cohort entries.
 */
export function repairPrimitiveFanout(
  args: RepairPrimitiveFanoutArgs
): RepairPrimitiveFanoutResult {
  const { hostNode, cohort } = args

  const validated = validateCohort(cohort)
  if (!validated.ok) return fail('cohort validation failed', { cohort })

  const subgraph = hostNode.subgraph
  const primitiveNode = subgraph.getNodeById(validated.primitiveNodeId)
  if (!primitiveNode) {
    return fail('primitive node missing', {
      primitiveNodeId: validated.primitiveNodeId
    })
  }
  if (primitiveNode.type !== PRIMITIVE_NODE_TYPE) {
    return fail('node is not a PrimitiveNode', {
      primitiveNodeId: validated.primitiveNodeId,
      type: primitiveNode.type
    })
  }

  const targets = collectTargets(hostNode, primitiveNode)
  if (!targets || targets.length === 0) {
    return fail('no targets to reconnect', {
      primitiveNodeId: validated.primitiveNodeId
    })
  }

  const primitiveOutput = primitiveNode.outputs?.[0]
  if (!primitiveOutput) return fail('primitive has no output')
  const primitiveOutputType = String(primitiveOutput.type ?? '*')

  // Pre-validate compatibility of every target before mutating.
  for (const target of targets) {
    const targetNode = subgraph.getNodeById(target.targetNodeId)
    if (!targetNode) return fail('target node missing', target)
    const targetSlot = targetNode.inputs?.[target.targetSlot]
    if (!targetSlot) return fail('target slot missing', target)
    const targetType = String(targetSlot.type ?? '*')
    if (
      targetType !== primitiveOutputType &&
      targetType !== '*' &&
      primitiveOutputType !== '*'
    ) {
      return fail('target slot type incompatible', {
        target,
        targetType,
        primitiveOutputType
      })
    }
  }

  const baseName = pickBaseName(primitiveNode, validated.sourceWidgetName)
  const existingNames = subgraph.inputs.map((input) => input.name)
  const uniqueName = nextUniqueName(baseName, existingNames)

  const snapshot = snapshotLinksForRollback(hostNode, primitiveNode)

  let newSubgraphInput: SubgraphInput | undefined
  try {
    newSubgraphInput = subgraph.addInput(uniqueName, primitiveOutputType)

    // Disconnect every former primitive→target link.
    for (const snap of snapshot) {
      const targetNode = subgraph.getNodeById(snap.targetNodeId)
      if (!targetNode)
        throw new Error(
          `target node ${snap.targetNodeId} disappeared mid-mutation`
        )
      targetNode.disconnectInput(snap.targetSlot, false)
    }

    // Reconnect each target slot from the new SubgraphInput, in target order.
    for (const target of targets) {
      const targetNode = subgraph.getNodeById(target.targetNodeId)
      if (!targetNode)
        throw new Error(`target node ${target.targetNodeId} disappeared`)
      const targetSlot = targetNode.inputs?.[target.targetSlot]
      if (!targetSlot)
        throw new Error(`target slot ${target.targetSlot} disappeared`)
      const link = newSubgraphInput.connect(targetSlot, targetNode)
      if (!link) {
        throw new Error('SubgraphInput.connect returned no link')
      }
    }
  } catch (e) {
    rollback(hostNode, primitiveNode, newSubgraphInput, snapshot)
    return fail('mutation failed; rolled back', { error: e })
  }

  // Apply value: prefer first-by-legacyOrderIndex non-hole host value;
  // otherwise seed from the primitive's source widget value if present.
  const hostValue = pickHostValue(validated.uniqueEntries)
  const valueToApply: TWidgetValue | undefined =
    hostValue !== undefined
      ? hostValue
      : (primitiveNode.widgets?.find(
          (w) => w.name === validated.sourceWidgetName
        )?.value as TWidgetValue | undefined)

  if (valueToApply !== undefined && newSubgraphInput._widget) {
    newSubgraphInput._widget.value = valueToApply
  }

  return {
    ok: true,
    subgraphInputName: newSubgraphInput.name,
    reconnectCount: targets.length
  }
}
