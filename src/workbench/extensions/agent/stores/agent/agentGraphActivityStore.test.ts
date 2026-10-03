import { disposePinia, getActivePinia } from 'pinia'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// oxlint-disable-next-line comfy/no-restricted-paths -- exercise the production store's graph-removal subscription at its renderer boundary.
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { toTurnId } from '../../schemas/agentApiSchema'
import { useAgentGraphActivityStore } from './agentGraphActivityStore'
import { nextTick } from 'vue'

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

  it('does not override a manual minimap hide during a running turn', async () => {
    const settings = useSettingStore()
    settings.settingValues['Comfy.Minimap.Visible'] = false
    const setSetting = vi.spyOn(settings, 'set').mockResolvedValue()
    const activity = useAgentGraphActivityStore()

    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    await nextTick()

    settings.settingValues['Comfy.Minimap.Visible'] = false
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(2)]
    )
    await nextTick()

    expect(setSetting).toHaveBeenCalledTimes(1)
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

  it('forgets nodes removed after the active graph changes', async () => {
    const rootEvents = new EventTarget()
    const subgraphEvents = new EventTarget()
    const rootGraph = fromPartial<LGraph>({
      events: rootEvents,
      rootGraph: fromPartial<LGraph>({ events: rootEvents })
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial({ graph: rootGraph })
    await nextTick()
    canvasStore.currentGraph = rootGraph
    useSettingStore().settingValues['Comfy.Minimap.Visible'] = true
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1), toNodeId(2)]
    )

    canvasStore.currentGraph = fromPartial({
      events: subgraphEvents,
      rootGraph
    })
    await nextTick()
    subgraphEvents.dispatchEvent(
      new CustomEvent('node:removed', { detail: { node: { id: 1 } } })
    )

    expect(activity.state).toMatchObject({ nodeIds: ['2'] })
  })

  it('forgets root nodes removed while a subgraph is active', async () => {
    const rootEvents = new EventTarget()
    const rootGraph = fromPartial<LGraph>({
      events: rootEvents,
      rootGraph: fromPartial<LGraph>({ events: rootEvents })
    })
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial({ graph: rootGraph })
    canvasStore.currentGraph = fromPartial({
      events: new EventTarget(),
      rootGraph
    })
    useSettingStore().settingValues['Comfy.Minimap.Visible'] = true
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1), toNodeId(2)]
    )

    rootEvents.dispatchEvent(
      new CustomEvent('node:removed', { detail: { node: { id: 1 } } })
    )

    expect(activity.state).toMatchObject({ nodeIds: ['2'] })
  })

  it('cancels settlement when its Pinia scope is disposed', () => {
    const activity = useAgentGraphActivityStore()
    activity.recordMaterialized(
      { workflowId: 'wf-1', rootGraphId: ROOT_GRAPH_ID },
      [toNodeId(1)]
    )
    activity.finishTurn()
    const stateAtDispose = activity.state

    disposePinia(getActivePinia()!)
    vi.advanceTimersByTime(1_000)

    expect(activity.state).toEqual(stateAtDispose)
    expect(activity.state.phase).toBe('settling')
  })
})
