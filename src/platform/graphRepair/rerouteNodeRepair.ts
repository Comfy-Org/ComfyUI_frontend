import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  convertRerouteNodes,
  isRerouteNode,
  planRerouteNodeConversion
} from '@/platform/graphRepair/rerouteNodeConversion'
import type {
  RerouteNodeConversionPlan,
  RerouteNodeSkipReason
} from '@/platform/graphRepair/rerouteNodeConversion'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

type UnchangedReason = RerouteNodeSkipReason | 'failed'

interface ConversionOutcome {
  converted: number
  unchanged: UnchangedReason[]
}

function convertPlanned(
  graph: LGraph,
  plan: RerouteNodeConversionPlan
): ConversionOutcome {
  const converted = convertRerouteNodes(graph, plan.convertible)
  const failed = plan.convertible.filter((node) => node.graph === graph)
  return {
    converted,
    unchanged: [
      ...plan.skipped.map(({ reason }) => reason),
      ...failed.map(() => 'failed' as const)
    ]
  }
}

function unchangedSummary(skipped: UnchangedReason[]): string | undefined {
  if (!skipped.length) return undefined
  const counts = new Map<UnchangedReason, number>()
  for (const reason of skipped)
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  const reasons = [...counts]
    .map(
      ([reason, count]) =>
        `${t(`rerouteConversion.reasons.${reason}`)} (${count})`
    )
    .join(', ')
  return t(
    'rerouteConversion.leftUnchanged',
    { count: skipped.length, reasons },
    skipped.length
  )
}

function reportConversion({ converted, unchanged }: ConversionOutcome) {
  const toast = useToast()
  const description = unchangedSummary(unchanged)
  if (!converted) {
    if (description)
      toast.warning(t('rerouteConversion.title'), { description })
    return
  }
  toast.success(
    t('rerouteConversion.converted', { count: converted }, converted),
    { description, duration: description ? undefined : 3000 }
  )
}

function convertInOneUndoStep(graph: LGraph, plan: RerouteNodeConversionPlan) {
  const changeTracker = useWorkflowStore().activeWorkflow?.changeTracker
  changeTracker?.beforeChange()
  try {
    reportConversion(convertPlanned(graph, plan))
  } finally {
    changeTracker?.afterChange()
  }
}

function repairItem(
  id: string,
  graph: LGraph,
  nodes: Iterable<LGraphNode>,
  label: (count: number) => string
) {
  const plan = planRerouteNodeConversion(graph, nodes)
  if (!plan.convertible.length) return undefined
  return {
    id,
    label: label(plan.convertible.length),
    action: () =>
      convertInOneUndoStep(graph, planRerouteNodeConversion(graph, nodes))
  }
}

export function nodeRerouteRepair(graph: LGraph, nodes: readonly LGraphNode[]) {
  return repairItem('convertRerouteNodes', graph, nodes, (count) =>
    t('rerouteConversion.convertSelected', { count }, count)
  )
}

export function canvasRerouteRepair(graph: LGraph) {
  return repairItem(
    'convertAllRerouteNodes',
    graph,
    graph.nodes.filter(isRerouteNode),
    () => t('rerouteConversion.convertAll')
  )
}

/** Converts every eligible Reroute node in the workflow while it loads and reports what changed. */
export function convertRerouteNodesOnLoad(rootGraph: LGraph): void {
  const outcomes = [rootGraph, ...rootGraph.subgraphs.values()].map((graph) =>
    convertPlanned(graph, planRerouteNodeConversion(graph, graph.nodes))
  )
  const outcome = {
    converted: outcomes.reduce((sum, { converted }) => sum + converted, 0),
    unchanged: outcomes.flatMap(({ unchanged }) => unchanged)
  }
  if (outcome.converted || outcome.unchanged.length) reportConversion(outcome)
}
