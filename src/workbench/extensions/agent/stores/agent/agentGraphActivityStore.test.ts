import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { toTurnId } from '../../schemas/agentApiSchema'
import { useAgentGraphActivityStore } from './agentGraphActivityStore'

const ROOT_GRAPH_ID = toRootGraphId('graph-1')
const TURN_1 = toTurnId('turn-1')
const TURN_2 = toTurnId('turn-2')

describe('agentGraphActivityStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('keeps sequential materializations through settlement', () => {
    const activity = useAgentGraphActivityStore()
    activity.startTurn()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(2), toNodeId(3)]
    )

    activity.finishTurn()
    vi.advanceTimersByTime(1_000)

    expect(activity.state).toEqual({
      phase: 'complete',
      workflowId: 'wf-1',
      rootGraphId: 'graph-1',
      nodeIds: ['1', '2', '3']
    })
  })

  it('starts from a materialization event and clears a reset workflow', () => {
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
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
    activity.startTurn(TURN_1)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    activity.finishTurn()
    activity.startTurn(TURN_1)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(2)]
    )

    expect(activity.state).toMatchObject({ nodeIds: ['1', '2'] })
  })

  it('starts a fresh report for a distinct turn during settlement', () => {
    const activity = useAgentGraphActivityStore()
    activity.startTurn(TURN_1)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    activity.finishTurn()
    activity.startTurn(TURN_2)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(2)]
    )

    expect(activity.state).toMatchObject({ nodeIds: ['2'] })
  })

  it('keeps a completed report when hydration resumes the same turn', () => {
    const activity = useAgentGraphActivityStore()
    activity.startTurn(TURN_1)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    activity.finishTurn()
    vi.advanceTimersByTime(1_000)

    activity.startTurn(TURN_1)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(2)]
    )

    expect(activity.state).toMatchObject({
      phase: 'running',
      nodeIds: ['1', '2']
    })
  })

  it('settles for a full interval after the latest materialization', () => {
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    activity.finishTurn()
    vi.advanceTimersByTime(500)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(2)]
    )
    activity.finishTurn()
    vi.advanceTimersByTime(500)

    expect(activity.state).toMatchObject({ phase: 'settling' })
    vi.advanceTimersByTime(500)
    expect(activity.state).toMatchObject({ phase: 'complete' })
  })

  it('PM-1874: does not attribute a late materialization from a finished turn to the next turn', () => {
    // Turn 1 finishes having materialized 1 node. Turn 2 starts and
    // materializes 3 of its own nodes. Then a LATE materialization for turn
    // 1's own node arrives (e.g. the CRDT follower resolved it only once the
    // node's dependency became visible, well after turn 1 ended) -- this is
    // the race: recordMaterialized has no turn-id check, only a
    // workflowId/rootGraphId match, so it folds straight into turn 2's
    // running report. The toast for turn 2 must still read 3, not 4.
    const activity = useAgentGraphActivityStore()
    activity.startTurn(TURN_1)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)],
      TURN_1
    )
    activity.finishTurn()
    vi.advanceTimersByTime(1_000)
    expect(activity.state).toMatchObject({ phase: 'complete', nodeIds: ['1'] })

    activity.startTurn(TURN_2)
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(2), toNodeId(3), toNodeId(4)],
      TURN_2
    )
    expect(activity.state).toMatchObject({ nodeIds: ['2', '3', '4'] })

    // The late straggler: belongs to turn 1, arrives while turn 2 is running.
    // A real caller (AgentPanelRoot.vue) always passes its current turn id,
    // so turn 1's straggler arrives tagged TURN_1 while TURN_2 is open.
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)],
      TURN_1
    )

    expect(activity.state).toMatchObject({ nodeIds: ['2', '3', '4'] })
  })

  it('PM-1874: a caller with no turn concept is unaffected by the turn guard', () => {
    // Omitting turnId entirely (the pre-fix call shape) must behave exactly
    // as before: no stale-turn filtering at all.
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    expect(activity.state).toMatchObject({ nodeIds: ['1'] })
  })

  it('forgets deleted nodes so reused ids are not attributed to the agent', () => {
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1), toNodeId(2)]
    )

    activity.removeNodes([toNodeId(1)])
    expect(activity.state).toMatchObject({ nodeIds: ['2'] })

    activity.removeNodes([toNodeId(2)])
    expect(activity.state).toEqual({ phase: 'idle' })
  })
})
