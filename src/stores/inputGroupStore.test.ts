import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type {
  LinearData,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'
import { ChangeTracker } from '@/scripts/changeTracker'

vi.mock(import('@/scripts/app'))

import { useInputGroupStore } from './inputGroupStore'

const inputIds = {
  a: widgetId('root', toNodeId(1), 'a'),
  b: widgetId('root', toNodeId(1), 'b'),
  c: widgetId('root', toNodeId(1), 'c'),
  steps: widgetId('root', toNodeId(2), 'steps')
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

  it('creates, renames, and deletes groups', () => {
    const id = store.createGroup()
    expect(store.inputGroups).toEqual([{ id, name: null, items: [] }])

    store.renameGroup(id, 'Dimensions')
    expect(store.inputGroups[0].name).toBe('Dimensions')

    store.deleteGroup(id)
    expect(store.inputGroups).toEqual([])
  })

  it('keeps one WidgetId in at most one group', () => {
    const first = store.createGroup('First')
    const second = store.createGroup('Second')
    store.addItemToGroup(first, inputIds.steps)
    store.addItemToGroup(second, inputIds.steps)

    expect(store.inputGroups).toHaveLength(1)
    expect(store.inputGroups[0]).toMatchObject({
      id: second,
      items: [{ key: inputIds.steps }]
    })
    expect(store.isGrouped(inputIds.steps)).toBe(true)
  })

  it('reorders items within a group', () => {
    const id = store.createGroup()
    store.addItemToGroup(id, inputIds.a)
    store.addItemToGroup(id, inputIds.b)
    store.addItemToGroup(id, inputIds.c)

    store.reorderWithinGroup(id, inputIds.c, inputIds.a, 'before')
    expect(store.inputGroups[0].items.map(({ key }) => key)).toEqual([
      inputIds.c,
      inputIds.a,
      inputIds.b
    ])

    store.reorderWithinGroup(id, inputIds.c, inputIds.b, 'after')
    expect(store.inputGroups[0].items.map(({ key }) => key)).toEqual([
      inputIds.a,
      inputIds.b,
      inputIds.c
    ])
  })

  it('pairs, replaces, and unpairs widgets', () => {
    const id = store.createGroup()
    store.addItemToGroup(id, inputIds.a)
    store.addItemToGroup(id, inputIds.b)
    store.addItemToGroup(id, inputIds.c)
    store.pairItemsInGroup(id, inputIds.a, inputIds.b)

    const initialPairId = store.inputGroups[0].items[0].pairId
    expect(initialPairId).toBeDefined()
    expect(store.inputGroups[0].items[1].pairId).toBe(initialPairId)

    store.replaceInPair(id, inputIds.a, inputIds.b)
    expect(store.inputGroups[0].items[0].pairId).toBe(initialPairId)
    expect(store.inputGroups[0].items[1].pairId).toBe(initialPairId)

    store.replaceInPair(id, inputIds.b, inputIds.c)
    const items = store.inputGroups[0].items
    expect(items.find(({ key }) => key === inputIds.c)?.pairId).toBe(
      initialPairId
    )
    expect(items.find(({ key }) => key === inputIds.b)?.pairId).toBeUndefined()

    store.unpairItem(id, inputIds.a)
    expect(items.every(({ pairId }) => pairId === undefined)).toBe(true)
  })

  it('moves an item between groups and pairs it at the target', () => {
    const source = store.createGroup('Source')
    const target = store.createGroup('Target')
    store.addItemToGroup(source, inputIds.c)
    store.addItemToGroup(target, inputIds.a)

    store.moveItemToGroupAt(target, inputIds.c, inputIds.a, 'center')

    expect(store.inputGroups).toHaveLength(1)
    expect(store.inputGroups[0].id).toBe(target)
    expect(store.inputGroups[0].items.map(({ key }) => key)).toEqual([
      inputIds.c,
      inputIds.a
    ])
    expect(store.inputGroups[0].items[0].pairId).toBe(
      store.inputGroups[0].items[1].pairId
    )
  })

  it('dissolves a pair and deletes an empty group when removing items', () => {
    const id = store.createGroup()
    store.addItemToGroup(id, inputIds.a)
    store.addItemToGroup(id, inputIds.b)
    store.pairItemsInGroup(id, inputIds.a, inputIds.b)

    store.removeItemFromGroup(id, inputIds.a)
    expect(store.inputGroups[0].items).toEqual([{ key: inputIds.b }])

    store.removeItemFromGroup(id, inputIds.b)
    expect(store.inputGroups).toEqual([])
  })

  it('persists groups without replacing inputs or outputs', () => {
    app.rootGraph.extra.linearData = {
      inputs: [[inputIds.steps, 'steps']],
      outputs: [toNodeId(3)]
    }

    const id = store.createGroup('Generation')
    store.addItemToGroup(id, inputIds.steps)

    const linearData = app.rootGraph.extra.linearData as LinearData
    expect(linearData.inputs).toEqual([[inputIds.steps, 'steps']])
    expect(linearData.outputs).toEqual([toNodeId(3)])
    expect(linearData.inputGroups).toEqual([
      {
        id,
        name: 'Generation',
        items: [{ key: inputIds.steps }]
      }
    ])
    expect(workflow.changeTracker.captureCanvasState).toHaveBeenCalled()
  })

  it('omits inputGroups from serialized data after the last group is deleted', () => {
    const id = store.createGroup()
    store.deleteGroup(id)

    expect(
      (app.rootGraph.extra.linearData as LinearData).inputGroups
    ).toBeUndefined()
  })
  it('ignores self moves and unknown targets without dropping the source group', () => {
    const id = store.createGroup()
    store.addItemToGroup(id, inputIds.a)
    store.moveItemToGroupAt(id, inputIds.a, inputIds.a, 'center')
    store.moveItemToGroupAt(id, inputIds.a, inputIds.b, 'before')
    expect(store.inputGroups).toEqual([
      { id, name: null, items: [{ key: inputIds.a }] }
    ])
  })

  it('restores groups when the graph is configured and detaches saved item objects', async () => {
    await nextTick()
    const saved = [{ id: 'saved', name: 'Saved', items: [{ key: inputIds.a }] }]
    app.rootGraph.extra.linearData = {
      inputs: [],
      outputs: [],
      inputGroups: saved
    }
    app.rootGraph.events.dispatch('configured')
    expect(store.inputGroups).toEqual(saved)
    store.addItemToGroup('saved', inputIds.b)
    expect(saved[0].items).toEqual([{ key: inputIds.a }])
    app.rootGraph.extra.linearData = {
      inputs: [],
      outputs: [],
      inputGroups: saved
    }
    app.rootGraph.events.dispatch('configured')
    expect(store.inputGroups[0].items).toEqual([{ key: inputIds.a }])
  })

  it('loads the active workflow groups and clears them on switching to an ungrouped workflow', async () => {
    const nextWorkflow = createMockLoadedWorkflow({
      activeMode: 'builder:arrange'
    })
    nextWorkflow.changeTracker.activeState.extra = {
      linearData: {
        inputs: [],
        outputs: [],
        inputGroups: [
          { id: 'next', name: 'Next', items: [{ key: inputIds.b }] }
        ]
      }
    }
    useWorkflowStore().activeWorkflow = nextWorkflow
    await nextTick()
    expect(store.inputGroups).toEqual([
      { id: 'next', name: 'Next', items: [{ key: inputIds.b }] }
    ])
    useWorkflowStore().activeWorkflow = workflow
    await nextTick()
    expect(store.inputGroups).toEqual([])
  })

  it('does not write graph state while graph loading is active', () => {
    ChangeTracker.isLoadingGraph = true
    store.createGroup('Loading')
    expect(app.rootGraph.extra.linearData).toBeUndefined()
    expect(workflow.changeTracker.captureCanvasState).not.toHaveBeenCalled()
    ChangeTracker.isLoadingGraph = false
  })
  it('dissolves a pair and records one history update when reordering a paired input', () => {
    const id = store.createGroup()
    store.addItemToGroup(id, inputIds.a)
    store.addItemToGroup(id, inputIds.b)
    store.addItemToGroup(id, inputIds.c)
    store.pairItemsInGroup(id, inputIds.a, inputIds.b)
    const captures = vi.mocked(workflow.changeTracker.captureCanvasState).mock
      .calls.length

    store.reorderWithinGroup(id, inputIds.a, inputIds.c, 'after')

    expect(store.findGroup(id)?.items).toEqual([
      { key: inputIds.b },
      { key: inputIds.c },
      { key: inputIds.a }
    ])
    expect(workflow.changeTracker.captureCanvasState).toHaveBeenCalledTimes(
      captures + 1
    )
  })

  it('creates a group with an input in one history update', () => {
    const captures = vi.mocked(workflow.changeTracker.captureCanvasState).mock
      .calls.length
    const id = store.createGroup(undefined, inputIds.a)
    expect(store.findGroup(id)).toEqual({
      id,
      name: null,
      items: [{ key: inputIds.a }]
    })
    expect(workflow.changeTracker.captureCanvasState).toHaveBeenCalledTimes(
      captures + 1
    )
  })
})
