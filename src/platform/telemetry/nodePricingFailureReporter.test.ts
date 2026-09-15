import type { NodePricingFailure } from '@comfyorg/shared-frontend-utils/nodePricingFailure'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('./reportError'), () => ({
  reportError: mockReportError
}))

async function loadReporter() {
  vi.resetModules()
  return (await import('./nodePricingFailureReporter')).reportNodePricingFailure
}

const failure = (
  overrides: Partial<NodePricingFailure> = {}
): NodePricingFailure => ({
  operation: 'evaluate',
  nodeType: 'BrokenNode',
  source: 'live_node',
  expr: '$error("boom")',
  cause: new Error('boom'),
  ...overrides
})

describe('reportNodePricingFailure', () => {
  beforeEach(() => {
    mockReportError.mockClear()
  })

  it('names the report after the JSONata error and keeps the original as cause', async () => {
    const reportNodePricingFailure = await loadReporter()
    // JSONata rejects with a plain object, not an Error.
    const cause = {
      code: 'T1006',
      message: 'Attempted to invoke a non-function',
      position: 14,
      token: 'notAFunction'
    }

    reportNodePricingFailure(failure({ cause }))

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: 'T1006: Attempted to invoke a non-function',
        cause
      }),
      {
        errorType: 'nodes_pricing_rule_evaluate_failed',
        tags: expect.objectContaining({
          pricing_operation: 'evaluate',
          evaluation_source: 'live_node',
          node_type: 'BrokenNode',
          jsonata_code: 'T1006'
        }),
        context: {
          expr: '$error("boom")',
          occurrenceCount: 1,
          jsonataPosition: 14,
          jsonataToken: 'notAFunction'
        },
        level: 'warning'
      }
    )
    expect(mockReportError.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it('passes a non-JSONata failure through untouched', async () => {
    const reportNodePricingFailure = await loadReporter()
    const cause = new TypeError('cacheLabel is not a function')

    reportNodePricingFailure(failure({ cause }))

    expect(mockReportError.mock.calls[0][0]).toBe(cause)
    expect(mockReportError.mock.calls[0][1].tags.jsonata_code).toBeUndefined()
  })

  it.for([
    ['compile', 'nodes_pricing_rule_compile_failed'],
    ['evaluate', 'nodes_pricing_rule_evaluate_failed'],
    ['format', 'nodes_pricing_label_format_failed']
  ] as const)('reports %s failures as %s', async ([operation, errorType]) => {
    const reportNodePricingFailure = await loadReporter()

    reportNodePricingFailure(failure({ operation }))

    expect(mockReportError.mock.calls[0][1].errorType).toBe(errorType)
  })

  it('bounds report volume when one rule fails across many evaluations', async () => {
    const reportNodePricingFailure = await loadReporter()

    // One scheduled evaluation per changing widget signature, all of the same
    // rule — dragging a numeric widget.
    for (let value = 0; value < 500; value++) {
      reportNodePricingFailure(
        failure({ cause: new Error(`boom at ${value}`) })
      )
    }

    expect(mockReportError).toHaveBeenCalledTimes(3)
    expect(
      mockReportError.mock.calls.map(
        ([, options]) => options.context.occurrenceCount
      )
    ).toEqual([1, 10, 100])
  })

  it('caps the number of distinct failing rules per session', async () => {
    const reportNodePricingFailure = await loadReporter()

    for (let i = 0; i < 200; i++) {
      reportNodePricingFailure(failure({ nodeType: `BadNodePack_${i}` }))
    }

    expect(mockReportError).toHaveBeenCalledTimes(20)
  })

  it('reports the same node type separately per operation and source', async () => {
    const reportNodePricingFailure = await loadReporter()

    reportNodePricingFailure(failure())
    reportNodePricingFailure(failure({ source: 'node_definition' }))
    reportNodePricingFailure(failure({ operation: 'compile' }))

    expect(mockReportError).toHaveBeenCalledTimes(3)
  })
})
