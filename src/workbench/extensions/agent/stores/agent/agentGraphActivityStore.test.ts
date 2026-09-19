import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import { useAgentGraphActivityStore } from './agentGraphActivityStore'

describe('agentGraphActivityStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('keeps sequential materializations through settle and a UI remount', () => {
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'graph-1' },
      [toNodeId(1)]
    )
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'graph-1' },
      [toNodeId(2), toNodeId(3)]
    )

    activity.finishTurn()
    vi.advanceTimersByTime(1_000)

    const remounted = useAgentGraphActivityStore()
    expect(remounted.state).toEqual({
      phase: 'complete',
      workflowId: 'wf-1',
      rootGraphId: 'graph-1',
      nodeIds: ['1', '2', '3']
    })
  })

  it('starts from a materialization event and clears a reset workflow', () => {
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'graph-1' },
      [toNodeId(1)]
    )
    expect(activity.state).toEqual({
      phase: 'running',
      workflowId: 'wf-1',
      rootGraphId: 'graph-1',
      nodeIds: ['1']
    })
    activity.resetWorkflow('wf-1')
    expect(activity.state).toEqual({ phase: 'idle' })
  })

  it('treats an idle dip followed by activity as the same turn', () => {
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'graph-1' },
      [toNodeId(1)]
    )
    activity.finishTurn()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'graph-1' },
      [toNodeId(2)]
    )

    expect(activity.state).toMatchObject({ nodeIds: ['1', '2'] })
  })

  it('settles for a full interval after the latest materialization', () => {
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'graph-1' },
      [toNodeId(1)]
    )
    activity.finishTurn()
    vi.advanceTimersByTime(500)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: 'graph-1' },
      [toNodeId(2)]
    )
    activity.finishTurn()
    vi.advanceTimersByTime(500)

    expect(activity.state).toMatchObject({ phase: 'settling' })
    vi.advanceTimersByTime(500)
    expect(activity.state).toMatchObject({ phase: 'complete' })
  })
})
