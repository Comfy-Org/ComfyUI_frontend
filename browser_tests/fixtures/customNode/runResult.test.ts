import { describe, expect, it } from 'vitest'

import {
  classifyRun,
  describeRunOutcome
} from '@e2e/fixtures/customNode/runResult'

describe('classifyRun', () => {
  it('PASS when every expected node appears in the executing stream', () => {
    const result = classifyRun({
      events: [
        { type: 'execution_start' },
        { type: 'executing', node: '1' },
        { type: 'executing', node: '2' },
        { type: 'executing', node: null },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1', '2']
    })
    expect(result.outcome).toBe('PASS')
    expect(result.executedNodes).toEqual(['1', '2'])
  })

  it('PASS when an expected node was served from cache instead of run', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        { type: 'execution_cached', nodes: ['2'] },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1', '2']
    })
    expect(result.outcome).toBe('PASS')
    expect(result.executedNodes).toEqual(['1', '2'])
  })

  it('PARTIAL when a node appears in neither the executing nor the cached stream', () => {
    const result = classifyRun({
      events: [
        { type: 'execution_cached', nodes: ['1'] },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1', '2']
    })
    expect(result.outcome).toBe('PARTIAL')
    expect(result.executedNodes).toEqual(['1'])
  })

  it('PASS when a missing execution event has a non-null downstream output', () => {
    const result = classifyRun({
      events: [
        { type: 'executed', node: 'sink', output: { text: ['value'] } },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['source'],
      proofOutputNodeByExpectedNode: { source: 'sink' }
    })
    expect(result.outcome).toBe('PASS')
  })

  it('PARTIAL when a downstream output is missing or null', () => {
    for (const output of [undefined, null]) {
      const result = classifyRun({
        events: [
          { type: 'executed', node: 'sink', output },
          { type: 'execution_success' }
        ],
        expectedNodeIds: ['source'],
        proofOutputNodeByExpectedNode: { source: 'sink' }
      })
      expect(result.outcome).toBe('PARTIAL')
    }
  })

  it('a node named by both streams is counted once', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        { type: 'execution_cached', nodes: ['1', '2'] },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1', '2']
    })
    expect(result.outcome).toBe('PASS')
    expect(result.executedNodes).toEqual(['1', '2'])
  })

  it('EXECUTION_ERROR captures the failing node details', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        {
          type: 'execution_error',
          error: {
            exceptionMessage: 'inputs have different channel counts',
            exceptionType: 'ValueError',
            nodeId: '1',
            nodeType: 'AudioConcatenate'
          }
        }
      ],
      expectedNodeIds: ['1']
    })
    expect(result.outcome).toBe('EXECUTION_ERROR')
    expect(result.error?.exceptionType).toBe('ValueError')
    expect(describeRunOutcome(result)).toBe(
      'EXECUTION_ERROR (AudioConcatenate: ValueError - inputs have different channel counts)'
    )
  })

  it('describes an execution error even when Cloud omits node identity', () => {
    expect(
      describeRunOutcome({
        outcome: 'EXECUTION_ERROR',
        executedNodes: [],
        outputsByNode: {},
        error: { exceptionMessage: 'allocation failed' }
      })
    ).toBe('EXECUTION_ERROR (allocation failed)')
  })

  it('an executing event outside the queued graph cannot satisfy a node', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        { type: 'executing', node: '2' },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1', '2'],
      graphNodeIds: ['1']
    })
    expect(result.executedNodes).toEqual(['1'])
    expect(result.outcome).toBe('PARTIAL')
  })

  it('a stray executed event cannot stand in as downstream proof', () => {
    const result = classifyRun({
      events: [
        { type: 'executed', node: 'sink', output: { text: ['value'] } },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['source'],
      proofOutputNodeByExpectedNode: { source: 'sink' },
      graphNodeIds: ['source']
    })
    expect(result.outputsByNode).toEqual({})
    expect(result.outcome).toBe('PARTIAL')
  })

  it('cached nodes from another prompt do not count as executed', () => {
    const result = classifyRun({
      events: [
        { type: 'execution_cached', nodes: ['1', '99'] },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1'],
      graphNodeIds: ['1']
    })
    expect(result.executedNodes).toEqual(['1'])
    expect(result.outcome).toBe('PASS')
  })

  it('an execution_error naming a node outside the queued graph is not this run', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        {
          type: 'execution_error',
          error: { exceptionMessage: 'stray', nodeId: '99' }
        },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1'],
      graphNodeIds: ['1']
    })
    expect(result.outcome).toBe('PASS')
    expect(result.error).toBeUndefined()
  })

  it('an execution_error inside the queued graph, or carrying no node id, is reported', () => {
    const inGraph = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        {
          type: 'execution_error',
          error: { exceptionMessage: 'ours', nodeId: '1' }
        },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1'],
      graphNodeIds: ['1']
    })
    const anonymous = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        { type: 'execution_error', error: { exceptionMessage: 'allocation' } },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1'],
      graphNodeIds: ['1']
    })
    expect(inGraph.outcome).toBe('EXECUTION_ERROR')
    expect(inGraph.error?.exceptionMessage).toBe('ours')
    expect(anonymous.outcome).toBe('EXECUTION_ERROR')
    expect(anonymous.error?.exceptionMessage).toBe('allocation')
  })

  it('an executed event carries the ui payload without counting as a run', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        { type: 'executed', node: '1', output: { images: ['a.png'] } },
        { type: 'executed', node: '2', output: { images: ['b.png'] } },
        { type: 'executed', node: null, output: { images: [] } },
        { type: 'execution_success' }
      ],
      expectedNodeIds: ['1', '2']
    })
    expect(result.outputsByNode).toEqual({
      '1': { images: ['a.png'] },
      '2': { images: ['b.png'] }
    })
    expect(result.executedNodes).toEqual(['1'])
    expect(result.outcome).toBe('PARTIAL')
  })

  it('EXECUTION_ERROR when the run is interrupted', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        { type: 'execution_interrupted' }
      ],
      expectedNodeIds: ['1']
    })
    expect(result.outcome).toBe('EXECUTION_ERROR')
  })

  it('TIMEOUT when flagged or when no terminal event arrived', () => {
    const flagged = classifyRun({
      events: [{ type: 'executing', node: '1' }],
      expectedNodeIds: ['1'],
      timedOut: true
    })
    const noTerminal = classifyRun({
      events: [{ type: 'executing', node: '1' }],
      expectedNodeIds: ['1']
    })
    expect(flagged.outcome).toBe('TIMEOUT')
    expect(noTerminal.outcome).toBe('TIMEOUT')
  })
})
