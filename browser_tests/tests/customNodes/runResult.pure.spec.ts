import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { classifyRun } from '@e2e/fixtures/customNode/runResult'

test.describe('classifyRun', () => {
  test('PASS when every expected node appears in the executing stream', () => {
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

  test('PASS when an expected node was served from cache instead of run', () => {
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

  test('PARTIAL when a node appears in neither the executing nor the cached stream', () => {
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

  test('a node named by both streams is counted once', () => {
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

  test('EXECUTION_ERROR captures the failing node details', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        {
          type: 'execution_error',
          error: { exceptionType: 'ValueError', nodeId: '1' }
        }
      ],
      expectedNodeIds: ['1']
    })
    expect(result.outcome).toBe('EXECUTION_ERROR')
    expect(result.error?.exceptionType).toBe('ValueError')
  })

  test('EXECUTION_ERROR when the run is interrupted', () => {
    const result = classifyRun({
      events: [
        { type: 'executing', node: '1' },
        { type: 'execution_interrupted' }
      ],
      expectedNodeIds: ['1']
    })
    expect(result.outcome).toBe('EXECUTION_ERROR')
  })

  test('TIMEOUT when flagged or when no terminal event arrived', () => {
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
