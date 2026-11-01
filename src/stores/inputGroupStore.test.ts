import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type {
  LinearData,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/scripts/app'))

import { useInputGroupStore } from './inputGroupStore'

const inputIds = {
  a: widgetId('root', toNodeId(1), 'a'),
  b: widgetId('root', toNodeId(1), 'b'),
  c: widgetId('root', toNodeId(1), 'c')
}

describe('inputGroupStore', () => {
  let store: ReturnType<typeof useInputGroupStore>
  let workflow: LoadedComfyWorkflow

  beforeEach(() => {
    app.rootGraph.extra = {}
    ChangeTracker.isLoadingGraph = false
    workflow = createMockLoadedWorkflow({ activeMode: 'builder:arrange' })
    useWorkflowStore().activeWorkflow = workflow
    store = useInputGroupStore()
  })

  it('creates, renames, and deletes groups without deleting selected inputs', () => {
    const id = store.createGroup(undefined, inputIds.a)
    expect(store.findGroup(id)?.items).toEqual([{ key: inputIds.a }])
    store.renameGroup(id, 'Dimensions')
    expect(store.findGroup(id)?.name).toBe('Dimensions')
    store.deleteGroup(id)
    expect(store.inputGroups).toEqual([])
  })

  it('moves an input between groups with one history entry', () => {
    const first = store.createGroup('First', inputIds.a)
    const second = store.createGroup('Second', inputIds.b)
    const captures = vi.mocked(workflow.changeTracker.captureCanvasState).mock.calls.length
    store.addItemToGroup(second, inputIds.a)
    expect(store.findGroup(first)).toBeUndefined()
    expect(store.findGroup(second)?.items).toEqual([
      { key: inputIds.b },
      { key: inputIds.a }
    ])
    expect(workflow.changeTracker.captureCanvasState).toHaveBeenCalledTimes(captures + 1)
  })

  it('persists metadata while preserving selected inputs and outputs', () => {
    app.rootGraph.extra.linearData = {
      inputs: [[inputIds.a, 'a']],
      outputs: [toNodeId(3)]
    }
    const id = store.createGroup('Generation', inputIds.a)
    const data = app.rootGraph.extra.linearData as LinearData
    expect(data.inputs).toEqual([[inputIds.a, 'a']])
    expect(data.outputs).toEqual([toNodeId(3)])
    expect(data.inputGroups).toEqual([
      { id, name: 'Generation', items: [{ key: inputIds.a }] }
    ])
  })

  it('clears persisted grouping after the last group is deleted', () => {
    const id = store.createGroup()
    store.deleteGroup(id)
    expect((app.rootGraph.extra.linearData as LinearData).inputGroups).toBeUndefined()
  })

  it('restores imported groups and detaches mutable saved objects', async () => {
    await nextTick()
    const saved = [{ id: 'saved', name: 'Saved', items: [{ key: inputIds.a }] }]
    app.rootGraph.extra.linearData = { inputs: [], outputs: [], inputGroups: saved }
    app.rootGraph.events.dispatch('configured')
    expect(store.inputGroups).toEqual(saved)
    store.addItemToGroup('saved', inputIds.b)
    expect(saved[0].items).toEqual([{ key: inputIds.a }])
  })

  it('normalizes duplicate group IDs, repeated inputs and invalid pairs', async () => {
    await nextTick()
    app.rootGraph.extra.linearData = {
      inputs: [],
      outputs: [],
      inputGroups: [
        { id: 'one', name: null, items: [
          { key: inputIds.a, pairId: 'orphan' },
          { key: inputIds.a },
          { key: inputIds.b }
        ] },
        { id: 'one', name: 'Repeated', items: [{ key: inputIds.c }] },
        { id: 'two', name: 'Second', items: [
          { key: inputIds.a },
          { key: inputIds.c }
        ] }
      ]
    }
    app.rootGraph.events.dispatch('configured')
    expect(store.inputGroups).toEqual([
      { id: 'one', name: null, items: [
        { key: inputIds.a },
        { key: inputIds.b }
      ] },
      { id: 'two', name: 'Second', items: [{ key: inputIds.c }] }
    ])
  })

  it('does not persist while a workflow graph is loading', () => {
    ChangeTracker.isLoadingGraph = true
    store.createGroup('Loading')
    expect(app.rootGraph.extra.linearData).toBeUndefined()
    expect(workflow.changeTracker.captureCanvasState).not.toHaveBeenCalled()
    ChangeTracker.isLoadingGraph = false
  })

  it('clears groups when switching back to an ungrouped workflow', async () => {
    const next = createMockLoadedWorkflow({ activeMode: 'builder:arrange' })
    next.changeTracker.activeState.extra = {
      linearData: {
        inputs: [],
        outputs: [],
        inputGroups: [{ id: 'other', name: null, items: [{ key: inputIds.c }] }]
      }
    }
    useWorkflowStore().activeWorkflow = next
    await nextTick()
    expect(store.inputGroups[0].id).toBe('other')
    useWorkflowStore().activeWorkflow = workflow
    await nextTick()
    expect(store.inputGroups).toEqual([])
  })
})
