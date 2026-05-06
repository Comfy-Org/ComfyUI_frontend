import type {
  MigrationPlan,
  PrimitiveBypassTargetRef,
  ProxyEntryClassification
} from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import {
  getPromotableWidgets,
  isPreviewPseudoWidget
} from '@/core/graph/subgraph/promotionUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

export interface ClassificationResult {
  classification: ProxyEntryClassification
  plan: MigrationPlan
}

interface ClassifyProxyEntryArgs {
  hostNode: SubgraphNode
  normalized: PromotedWidgetSource
  /** All proxy entries this planner pass is considering — needed to detect primitive fan-out. */
  cohort: readonly PromotedWidgetSource[]
}

const PRIMITIVE_NODE_TYPE = 'PrimitiveNode'

function findLinkedSubgraphInputName(
  hostNode: SubgraphNode,
  normalized: PromotedWidgetSource
): string | undefined {
  for (const input of hostNode.inputs) {
    const widget = input._widget
    if (!widget || !isPromotedWidgetView(widget)) continue
    if (
      widget.sourceNodeId === normalized.sourceNodeId &&
      widget.sourceWidgetName === normalized.sourceWidgetName
    ) {
      return input.name
    }
  }
  return undefined
}

function collectPrimitiveTargets(
  hostNode: SubgraphNode,
  primitiveNode: LGraphNode
): PrimitiveBypassTargetRef[] {
  const subgraph = hostNode.subgraph
  const output = primitiveNode.outputs?.[0]
  const linkIds = output?.links ?? []
  const targets: PrimitiveBypassTargetRef[] = []
  for (const linkId of linkIds) {
    const link = subgraph.links.get(linkId)
    if (!link) continue
    targets.push({
      targetNodeId: link.target_id,
      targetSlot: link.target_slot
    })
  }
  return targets
}

function cohortReferencesPrimitive(
  cohort: readonly PromotedWidgetSource[],
  primitiveNodeId: string
): boolean {
  let count = 0
  for (const entry of cohort) {
    if (entry.sourceNodeId === primitiveNodeId) {
      count += 1
      if (count >= 2) return true
    }
  }
  return false
}

export function classifyProxyEntry(
  args: ClassifyProxyEntryArgs
): ClassificationResult {
  const { hostNode, normalized, cohort } = args

  const linkedInputName = findLinkedSubgraphInputName(hostNode, normalized)
  if (linkedInputName !== undefined) {
    return {
      classification: 'value',
      plan: { kind: 'alreadyLinked', subgraphInputName: linkedInputName }
    }
  }

  const sourceNode = hostNode.subgraph.getNodeById(normalized.sourceNodeId)
  if (!sourceNode) {
    return {
      classification: 'unknown',
      plan: { kind: 'quarantine', reason: 'missingSourceNode' }
    }
  }

  if (sourceNode.type === PRIMITIVE_NODE_TYPE) {
    const targets = collectPrimitiveTargets(hostNode, sourceNode)
    const cohortDuplicated = cohortReferencesPrimitive(
      cohort,
      normalized.sourceNodeId
    )
    if (targets.length >= 1 || cohortDuplicated) {
      return {
        classification: 'primitiveFanout',
        plan: {
          kind: 'primitiveBypass',
          primitiveNodeId: sourceNode.id,
          sourceWidgetName: normalized.sourceWidgetName,
          targets
        }
      }
    }
    return {
      classification: 'unknown',
      plan: { kind: 'quarantine', reason: 'unlinkedSourceWidget' }
    }
  }

  const promotableWidgets = getPromotableWidgets(sourceNode)
  const sourceWidget = promotableWidgets.find(
    (w) => w.name === normalized.sourceWidgetName
  )
  if (!sourceWidget) {
    return {
      classification: 'unknown',
      plan: { kind: 'quarantine', reason: 'missingSourceWidget' }
    }
  }

  if (
    normalized.sourceWidgetName.startsWith('$$') ||
    isPreviewPseudoWidget(sourceWidget)
  ) {
    return {
      classification: 'preview',
      plan: {
        kind: 'previewExposure',
        sourcePreviewName: normalized.sourceWidgetName
      }
    }
  }

  return {
    classification: 'value',
    plan: {
      kind: 'createSubgraphInput',
      sourceWidgetName: normalized.sourceWidgetName
    }
  }
}
