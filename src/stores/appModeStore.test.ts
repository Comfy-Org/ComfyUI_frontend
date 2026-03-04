import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { extra: {} }
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({ read_only: false })
  })
}))

import { useAppModeStore } from './appModeStore'

function createBuilderWorkflow(
  activeMode: string = 'builder:select'
): LoadedComfyWorkflow {
  const workflow = new ComfyWorkflowClass({
    path: 'workflows/test.json',
    modified: Date.now(),
    size: 100
  })
  workflow.changeTracker = createMockChangeTracker()
  workflow.content = '{}'
  workflow.originalContent = '{}'
  workflow.activeMode = activeMode as LoadedComfyWorkflow['activeMode']
  return workflow as LoadedComfyWorkflow
}

describe('appModeStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.mocked(app.rootGraph).extra = {}
  })

  describe('enterBuilder', () => {
    it('navigates to builder:arrange when in app mode with outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('app')

      const store = useAppModeStore()
      store.selectedOutputs.push(1)

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:arrange')
    })

    it('navigates to builder:select when in app mode without outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('app')

      const store = useAppModeStore()

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:select')
    })

    it('navigates to builder:select when in graph mode with outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      const store = useAppModeStore()
      store.selectedOutputs.push(1)

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:select')
    })

    it('navigates to builder:select when in graph mode without outputs', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      const store = useAppModeStore()

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:select')
    })
  })

  describe('linearData sync watcher', () => {
    it('writes linearData to rootGraph.extra when in builder mode', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [],
        outputs: [1]
      })
    })

    it('does not write linearData when not in builder mode', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      const workflow = createBuilderWorkflow()
      workflow.activeMode = 'graph'
      workflowStore.activeWorkflow = workflow
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toBeUndefined()
    })

    it('does not write when rootGraph is null', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      const originalRootGraph = app.rootGraph
      Object.defineProperty(app, 'rootGraph', { value: null, writable: true })

      store.selectedOutputs.push(1)
      await nextTick()

      Object.defineProperty(app, 'rootGraph', {
        value: originalRootGraph,
        writable: true
      })
    })

    it('reflects input changes in linearData', async () => {
      const workflowStore = useWorkflowStore()
      const store = useAppModeStore()

      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [[42, 'prompt']],
        outputs: []
      })
    })
  })
})
