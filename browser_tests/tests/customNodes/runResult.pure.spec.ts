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

  test('PARTIAL when a succeeding run replays a cached node that never emitted executing', () => {
    const result = classifyRun({
      events: [{ type: 'executing', node: '1' }, { type: 'execution_success' }],
      expectedNodeIds: ['1', '2']
    })
    expect(result.outcome).toBe('PARTIAL')
    expect(result.executedNodes).toEqual(['1'])
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
