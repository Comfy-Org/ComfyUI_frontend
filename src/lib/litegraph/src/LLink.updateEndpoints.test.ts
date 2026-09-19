import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

function createOccupiedTargetFixture() {
  const graph = new LGraph()
  const firstSource = new LGraphNode('First source')
  const secondSource = new LGraphNode('Second source')
  const target = new LGraphNode('Target')
  firstSource.addOutput('out', 'INT')
  secondSource.addOutput('out', 'INT')
  target.addInput('first', 'INT')
  target.addInput('second', 'INT')
  graph.add(firstSource)
  graph.add(secondSource)
  graph.add(target)
  const first = firstSource.connect(0, target, 0)!
  secondSource.connect(0, target, 1)
  return { graph, first, target }
}

describe('LLink.updateEndpoints rejection handling', () => {
  it('returns a distinguishable failure and reports it through telemetry', () => {
    mockReportError.mockClear()
    const { first } = createOccupiedTargetFixture()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = first.updateEndpoints({ targetSlot: 1 })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected rejection')
    expect(result.error.code).toBe('occupied-target')
    expect(first.target_slot).toBe(0)
    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'link_endpoint_update_rejected',
        context: expect.objectContaining({
          code: 'occupied-target',
          linkId: first.id,
          patch: { targetSlot: 1 }
        })
      })
    )
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('returns ok with the updated topology when the store accepts the patch', () => {
    mockReportError.mockClear()
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    const target = new LGraphNode('Target')
    source.addOutput('out', 'INT')
    target.addInput('first', 'INT')
    target.addInput('second', 'INT')
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)!

    const result = link.updateEndpoints({ targetSlot: 1 })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected success')
    expect(result.value.targetSlot).toBe(1)
    expect(link.target_slot).toBe(1)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('legacy setters keep the previous endpoint on rejection without throwing', () => {
    mockReportError.mockClear()
    const { first } = createOccupiedTargetFixture()

    expect(() => {
      first.target_slot = 1
    }).not.toThrow()
    expect(first.target_slot).toBe(0)
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })
})
