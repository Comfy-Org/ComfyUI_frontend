import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'

import { ChangeTracker } from './changeTracker'

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {},
    rootGraph: {
      extra: {},
      nodes: [{ id: 1 }],
      serialize: vi.fn()
    }
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({ read_only: false })
  })
}))

vi.mock('@/components/builder/useEmptyWorkflowDialog', () => ({
  useEmptyWorkflowDialog: () => ({
    show: vi.fn()
  })
}))

vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveNode: vi.fn(() => undefined)
}))

import { app } from '@/scripts/app'

function createWorkflowJSON(
  nodeIds: number[],
  extra: Record<string, unknown> = {}
): ComfyWorkflowJSON {
  return {
    last_node_id: nodeIds.length,
    last_link_id: 0,
    nodes: nodeIds.map((id) => ({
      id,
      type: 'TestNode',
      pos: [0, 0],
      size: [100, 100],
      flags: {},
      order: id,
      mode: 0,
      outputs: [],
      inputs: [],
      properties: {}
    })),
    links: [],
    groups: [],
    config: {},
    version: 0.4,
    extra
  } as ComfyWorkflowJSON
}

function createLoadedWorkflow(
  path: string,
  state: ComfyWorkflowJSON
): LoadedComfyWorkflow {
  const workflow = new ComfyWorkflow({
    path,
    modified: Date.now(),
    size: 100
  })
  workflow.changeTracker = new ChangeTracker(workflow, state)
  workflow.content = JSON.stringify(state)
  workflow.originalContent = JSON.stringify(state)
  return workflow as LoadedComfyWorkflow
}

describe('ChangeTracker.isLoadingGraph guard', () => {
  let workflowStore: ReturnType<typeof useWorkflowStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    workflowStore = useWorkflowStore()
    ChangeTracker.isLoadingGraph = false
    vi.mocked(app.rootGraph).extra = {}
    vi.mocked(app.rootGraph).nodes = [{ id: 1 } as LGraphNode]
  })

  afterEach(() => {
    ChangeTracker.isLoadingGraph = false
  })

  describe('checkState short-circuit', () => {
    it('skips checkState when isLoadingGraph is true', () => {
      const workflowA = createWorkflowJSON([1])
      const workflowB = createWorkflowJSON([2, 3])

      const workflow = createLoadedWorkflow('workflows/test.json', workflowA)
      const tracker = workflow.changeTracker

      // Simulate rootGraph containing a different workflow's data
      vi.mocked(app.rootGraph.serialize).mockReturnValue(
        workflowB as unknown as ISerialisedGraph
      )

      // With guard enabled, checkState should not capture the wrong state
      ChangeTracker.isLoadingGraph = true
      tracker.checkState()

      expect(tracker.activeState).toEqual(workflowA)
      expect(tracker.undoQueue).toHaveLength(0)
    })

    it('captures state when isLoadingGraph is false', () => {
      const workflowA = createWorkflowJSON([1])
      const workflowB = createWorkflowJSON([2, 3])

      const workflow = createLoadedWorkflow('workflows/test.json', workflowA)
      const tracker = workflow.changeTracker

      vi.mocked(app.rootGraph.serialize).mockReturnValue(
        workflowB as unknown as ISerialisedGraph
      )

      // Without guard, checkState should capture the new state
      ChangeTracker.isLoadingGraph = false
      tracker.checkState()

      expect(tracker.activeState).toEqual(workflowB)
      expect(tracker.undoQueue).toHaveLength(1)
      expect(tracker.undoQueue[0]).toEqual(workflowA)
    })

    it('prevents cross-workflow corruption during tab switch', () => {
      const stateA = createWorkflowJSON([1], { name: 'workflowA' })
      const stateB = createWorkflowJSON([2, 3], { name: 'workflowB' })

      const workflowA = createLoadedWorkflow('workflows/a.json', stateA)

      // Simulate the corruption scenario:
      // 1. workflowA is the active workflow in the store
      workflowStore.activeWorkflow = workflowA

      // 2. During loadGraphData, rootGraph is configured with workflowB's data
      //    but activeWorkflow still points to workflowA
      ChangeTracker.isLoadingGraph = true
      vi.mocked(app.rootGraph.serialize).mockReturnValue(
        stateB as unknown as ISerialisedGraph
      )

      // 3. An extension calls checkState during onAfterGraphConfigured
      workflowA.changeTracker.checkState()

      // 4. With the guard, workflowA's state should NOT be corrupted
      expect(workflowA.changeTracker.activeState).toEqual(stateA)
      expect(workflowA.changeTracker.undoQueue).toHaveLength(0)

      // 5. After loading completes, the guard is lifted
      ChangeTracker.isLoadingGraph = false
    })

    it('allows corruption when guard is bypassed (regression confirmation)', () => {
      const stateA = createWorkflowJSON([1], { name: 'workflowA' })
      const stateB = createWorkflowJSON([2, 3], { name: 'workflowB' })

      const workflowA = createLoadedWorkflow('workflows/a.json', stateA)

      workflowStore.activeWorkflow = workflowA

      // Without the guard, checkState writes workflowB data into workflowA
      ChangeTracker.isLoadingGraph = false
      vi.mocked(app.rootGraph.serialize).mockReturnValue(
        stateB as unknown as ISerialisedGraph
      )

      workflowA.changeTracker.checkState()

      // workflowA's activeState is now corrupted with workflowB's data
      expect(workflowA.changeTracker.activeState).toEqual(stateB)
    })
  })

  describe('appModeStore linearData sync guard', () => {
    it('does not sync linearData when isLoadingGraph is true', async () => {
      // Dynamically import appModeStore after mocks are set up
      const { useAppModeStore } = await import('@/stores/appModeStore')
      const store = useAppModeStore()

      const workflow = createLoadedWorkflow(
        'workflows/test.json',
        createWorkflowJSON([1])
      )
      workflow.activeMode = 'builder:inputs'
      workflowStore.activeWorkflow = workflow
      await nextTick()

      // Set the guard
      ChangeTracker.isLoadingGraph = true
      vi.mocked(app.rootGraph).extra = {}

      // Modify selections — the watcher should skip writing to graph.extra
      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toBeUndefined()
    })

    it('syncs linearData when isLoadingGraph is false', async () => {
      const { useAppModeStore } = await import('@/stores/appModeStore')
      const store = useAppModeStore()

      const workflow = createLoadedWorkflow(
        'workflows/test.json',
        createWorkflowJSON([1])
      )
      workflow.activeMode = 'builder:inputs'
      workflowStore.activeWorkflow = workflow
      await nextTick()

      ChangeTracker.isLoadingGraph = false
      vi.mocked(app.rootGraph).extra = {}

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [],
        outputs: [1]
      })
    })
  })
})
