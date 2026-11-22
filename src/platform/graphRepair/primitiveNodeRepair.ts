import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  convertPrimitiveNodes,
  isPrimitiveNode,
  planPrimitiveNodeConversion
} from '@/platform/graphRepair/primitiveNodeConversion'
import type { PrimitiveNodeSkipReason } from '@/platform/graphRepair/primitiveNodeConversion'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'

type UnchangedReason = PrimitiveNodeSkipReason | 'failed'

function unchangedSummary(unchanged: UnchangedReason[]): string | undefined {
  if (!unchanged.length) return undefined
  const counts = new Map<UnchangedReason, number>()
  for (const reason of unchanged)
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  const reasons = [...counts]
    .map(
      ([reason, count]) =>
        `${t(`primitiveConversion.reasons.${reason}`)} (${count})`
    )
    .join(', ')
  return t(
    'primitiveConversion.leftUnchanged',
    { count: unchanged.length, reasons },
    unchanged.length
  )
}

function report(converted: number, unchanged: UnchangedReason[]) {
  const toast = useToast()
  const description = unchangedSummary(unchanged)
  if (!converted) {
    if (description)
      toast.warning(t('primitiveConversion.title'), { description })
    return
  }
  toast.success(
    t('primitiveConversion.converted', { count: converted }, converted),
    { description, duration: description ? undefined : 3000 }
  )
}

function convertInOneUndoStep(graph: LGraph, nodes: readonly LGraphNode[]) {
  const plan = planPrimitiveNodeConversion(graph, nodes)
  const canvas = useApp().canvas
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  changeTracker?.beforeChange()
  try {
    const wasSelected = new Set(
      plan.convertible.filter(({ node }) => canvas.selectedItems.has(node))
    )
    const converted = convertPrimitiveNodes(graph, plan.convertible)
    const selected = converted.filter((node) =>
      [...wasSelected].some((entry) => entry.node.id === node.id)
    )
    if (selected.length) {
      for (const { node } of wasSelected) canvas.deselect(node)
      canvas.selectItems(selected, true)
    }
    report(converted.length, [
      ...plan.skipped.map(({ reason }) => reason),
      ...Array<'failed'>(plan.convertible.length - converted.length).fill(
        'failed'
      )
    ])
  } finally {
    changeTracker?.afterChange()
  }
}

function repairItem(
  id: string,
  graph: LGraph,
  nodes: readonly LGraphNode[],
  label: (count: number) => string
) {
  const { convertible } = planPrimitiveNodeConversion(graph, nodes)
  if (!convertible.length) return undefined
  return {
    id,
    label: label(convertible.length),
    action: () => convertInOneUndoStep(graph, nodes)
  }
}

export function nodePrimitiveRepair(
  graph: LGraph,
  nodes: readonly LGraphNode[]
) {
  return repairItem('convertPrimitiveNodes', graph, nodes, (count) =>
    t('primitiveConversion.convertSelected', { count }, count)
  )
}

export function canvasPrimitiveRepair(graph: LGraph) {
  return repairItem(
    'convertAllPrimitiveNodes',
    graph,
    graph.nodes.filter(isPrimitiveNode),
    () => t('primitiveConversion.convertAll')
  )
}
