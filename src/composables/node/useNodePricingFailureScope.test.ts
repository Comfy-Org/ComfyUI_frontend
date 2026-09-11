import { setNodePricingFailureReporter } from '@comfyorg/shared-frontend-utils/nodePricingFailure'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { PriceBadge } from '@/schemas/nodeDefSchema'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const formatPricingResultMock = vi.hoisted(() => vi.fn())

vi.mock(
  import('@comfyorg/shared-frontend-utils/nodePricing'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    formatPricingResult: formatPricingResultMock
  })
)

const { useNodePricing } = await import('@/composables/node/useNodePricing')

const pricingFailureReporter = vi.fn()
setNodePricingFailureReporter(pricingFailureReporter)

const priceBadge = (expr: string): PriceBadge => ({
  engine: 'jsonata',
  expr,
  depends_on: { widgets: [], inputs: [], input_groups: [] }
})

const nodeWithRule = (nodeTypeName: string, expr: string): LGraphNode =>
  Object.assign(createMockLGraphNode(), {
    widgets: [],
    inputs: [],
    isInputConnected: () => false,
    constructor: {
      nodeData: {
        name: nodeTypeName,
        api_node: true,
        price_badge: priceBadge(expr)
      }
    }
  })

describe('scheduleEvaluation failure scoping', () => {
  it('does not report a label formatting bug as a rule evaluation failure', async () => {
    formatPricingResultMock.mockImplementation(() => {
      throw new TypeError('formatting regression')
    })
    const { getNodeDisplayPrice } = useNodePricing()
    const node = nodeWithRule('FormatBugNode', '{"type":"usd","usd":0.05}')

    getNodeDisplayPrice(node)
    await vi.waitFor(() => expect(pricingFailureReporter).toHaveBeenCalled(), {
      interval: 1
    })

    expect(pricingFailureReporter).toHaveBeenCalledExactlyOnceWith({
      operation: 'format',
      nodeType: 'FormatBugNode',
      source: 'live_node',
      expr: '{"type":"usd","usd":0.05}',
      cause: expect.objectContaining({ message: 'formatting regression' })
    })
  })
})
