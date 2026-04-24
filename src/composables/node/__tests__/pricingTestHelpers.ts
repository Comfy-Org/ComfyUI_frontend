import { __testAwaitPendingEvaluations } from '@/composables/node/useNodePricing'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { PriceBadge } from '@/schemas/nodeDefSchema'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

type WidgetInit = { name: string; value: unknown }

export const priceBadge = (
  expr: string,
  widgets: Array<{ name: string; type: string }> = [],
  inputs: string[] = [],
  inputGroups: string[] = []
): PriceBadge => ({
  engine: 'jsonata',
  expr,
  depends_on: { widgets, inputs, input_groups: inputGroups }
})

// Module-level counter for deterministic node IDs. Callers that care
// about id stability across tests should reset via `resetNodeIds()` in
// beforeEach — uniqueness across the suite is preserved regardless.
let nextNodeId = 1
export const resetNodeIds = () => {
  nextNodeId = 1
}

export function createApiNode(
  typeName: string,
  badge: PriceBadge | null,
  widgets: WidgetInit[] = []
): LGraphNode {
  const mockWidgets = widgets.map(({ name, value }) => ({
    name,
    value,
    type: 'combo'
  }))
  const base = createMockLGraphNode({ id: nextNodeId++, type: typeName })
  const nodeData: Record<string, unknown> = {
    name: typeName,
    api_node: true
  }
  if (badge) nodeData.price_badge = badge
  return Object.assign(base, {
    widgets: mockWidgets,
    inputs: [],
    constructor: { nodeData }
  })
}

export function createPlainNode(typeName: string): LGraphNode {
  const base = createMockLGraphNode({ id: nextNodeId++, type: typeName })
  return Object.assign(base, {
    widgets: [],
    inputs: [],
    constructor: {
      nodeData: { name: typeName, api_node: false }
    }
  })
}

export const makeGraph = (nodes: LGraphNode[]): LGraph =>
  ({ nodes }) as unknown as LGraph

// Deterministic wait: drain every in-flight pricing evaluation from the
// scheduler's tracking set. Replaces an earlier `setTimeout(r, 50)` that
// was both flaky (CI workers can take longer) and a waste when evals
// resolved faster than that.
export const flushPricingEval = () => __testAwaitPendingEvaluations()
