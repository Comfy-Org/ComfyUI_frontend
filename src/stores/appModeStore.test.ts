import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import type { ChangeTracker } from '@/scripts/changeTracker'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

const mockEmptyWorkflowDialog = vi.hoisted(() => {
  let lastOptions: { onEnterBuilder: () => void; onDismiss: () => void }
  return {
    show: vi.fn((options: typeof lastOptions) => {
      lastOptions = options
    }),
    get lastOptions() {
      return lastOptions
    }
  }
})

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { extra: {}, nodes: [{ id: 1 }] }
  }
}))

const mockResolveNode = vi.hoisted(() =>
  vi.fn<(id: NodeId) => LGraphNode | undefined>(() => undefined)
)
vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveNode: mockResolveNode
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({ read_only: false })
  })
}))

vi.mock('@/components/builder/useEmptyWorkflowDialog', () => ({
  useEmptyWorkflowDialog: () => mockEmptyWorkflowDialog
}))

import { useAppModeStore } from './appModeStore'

function createBuilderWorkflow(
  activeMode: string = 'builder:inputs'
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
  let workflowStore: ReturnType<typeof useWorkflowStore>
  let store: ReturnType<typeof useAppModeStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.mocked(app.rootGraph).extra = {}
    mockResolveNode.mockReturnValue(undefined)
    vi.mocked(app.rootGraph).nodes = [{ id: 1 } as LGraphNode]
    workflowStore = useWorkflowStore()
    store = useAppModeStore()
    vi.clearAllMocks()
  })

  describe('enterBuilder', () => {
    it('navigates to builder:arrange when in app mode with outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('app')
      store.selectedOutputs.push(1)

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:arrange')
    })

    it('navigates to builder:inputs when in app mode without outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('app')

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('navigates to builder:inputs when in graph mode with outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      store.selectedOutputs.push(1)

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('navigates to builder:inputs when in graph mode without outputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('shows empty workflow dialog when graph has no nodes', () => {
      vi.mocked(app.rootGraph).nodes = []
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()

      expect(mockEmptyWorkflowDialog.show).toHaveBeenCalledWith(
        expect.objectContaining({
          onEnterBuilder: expect.any(Function),
          onDismiss: expect.any(Function)
        })
      )
      expect(workflowStore.activeWorkflow!.activeMode).toBe('graph')
    })
  })

  describe('empty workflow dialog callbacks', () => {
    function getDialogOptions(nodes: LGraphNode[] = []) {
      vi.mocked(app.rootGraph).nodes = nodes
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      store.enterBuilder()
      return mockEmptyWorkflowDialog.lastOptions
    }

    it('onDismiss sets graph mode', () => {
      const options = getDialogOptions()

      // Move to builder so onDismiss must actually transition back
      workflowStore.activeWorkflow!.activeMode = 'builder:inputs'

      options.onDismiss()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('graph')
    })

    it('onEnterBuilder enters builder when nodes exist', () => {
      const options = getDialogOptions([{ id: 1 } as LGraphNode])

      options.onEnterBuilder()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:inputs')
    })

    it('onEnterBuilder shows dialog again when no nodes', () => {
      const options = getDialogOptions()

      mockEmptyWorkflowDialog.show.mockClear()
      options.onEnterBuilder()

      expect(mockEmptyWorkflowDialog.show).toHaveBeenCalled()
    })
  })

  describe('loadSelections pruning', () => {
    function mockNode(id: number) {
      return { id }
    }

    function workflowWithLinearData(
      inputs: [number, string][],
      outputs: number[]
    ) {
      const workflow = createBuilderWorkflow('app')
      workflow.changeTracker = createMockChangeTracker({
        activeState: {
          last_node_id: 0,
          last_link_id: 0,
          nodes: [],
          links: [],
          groups: [],
          config: {},
          version: 0.4,
          extra: { linearData: { inputs, outputs } }
        }
      } as unknown as Partial<ChangeTracker>)
      return workflow
    }

    it('removes inputs referencing deleted nodes on load', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? (node1 as unknown as LGraphNode) : undefined
      )

      workflowStore.activeWorkflow = workflowWithLinearData(
        [
          [1, 'prompt'],
          [99, 'width']
        ],
        []
      )
      await nextTick()

      expect(store.selectedInputs).toEqual([[1, 'prompt']])
    })

    it('keeps inputs for existing nodes even if widget is missing', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? (node1 as unknown as LGraphNode) : undefined
      )

      workflowStore.activeWorkflow = workflowWithLinearData(
        [
          [1, 'prompt'],
          [1, 'deleted_widget']
        ],
        []
      )
      await nextTick()

      expect(store.selectedInputs).toEqual([
        [1, 'prompt'],
        [1, 'deleted_widget']
      ])
    })

    it('removes outputs referencing deleted nodes on load', async () => {
      const node1 = mockNode(1)
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? (node1 as unknown as LGraphNode) : undefined
      )

      workflowStore.activeWorkflow = workflowWithLinearData([], [1, 99])
      await nextTick()

      expect(store.selectedOutputs).toEqual([1])
    })

    it('hasOutputs is false when all output nodes are deleted', async () => {
      mockResolveNode.mockReturnValue(undefined)

      workflowStore.activeWorkflow = workflowWithLinearData([], [10, 20])
      await nextTick()

      expect(store.selectedOutputs).toEqual([])
      expect(store.hasOutputs).toBe(false)
    })
  })

  describe('linearData sync watcher', () => {
    it('writes linearData to rootGraph.extra when in builder mode', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [],
        outputs: [1],
        layoutTemplateId: 'sidebar',
        zoneAssignmentsPerTemplate: {},
        gridOverridesPerTemplate: {},
        runControlsZoneIdPerTemplate: {},
        presetStripZoneIdPerTemplate: {},
        zoneItemOrderPerTemplate: {},
        zoneAlignPerTemplate: {},
        widgetOverrides: undefined,
        presets: undefined,
        presetDisplayMode: undefined
      })
    })

    it('does not write linearData when not in builder mode', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')
      await nextTick()

      store.selectedOutputs.push(1)
      await nextTick()

      expect(app.rootGraph.extra.linearData).toBeUndefined()
    })

    it('does not write when rootGraph is null', async () => {
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
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [[42, 'prompt']],
        outputs: [],
        layoutTemplateId: 'sidebar',
        zoneAssignmentsPerTemplate: {},
        gridOverridesPerTemplate: {},
        runControlsZoneIdPerTemplate: {},
        presetStripZoneIdPerTemplate: {},
        zoneItemOrderPerTemplate: {},
        zoneAlignPerTemplate: {},
        widgetOverrides: undefined,
        presets: undefined,
        presetDisplayMode: undefined
      })
    })
  })

  describe('autoAssignInputs', () => {
    it('distributes inputs evenly across input zones', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([1, 'a'], [2, 'b'], [3, 'c'], [4, 'd'])
      // sidebar template has 4 input zones: z1, z3, z4, sb
      // and 1 output zone: z2
      store.autoAssignInputs()

      const zones = new Map<string, number>()
      for (const [nodeId, widgetName] of store.selectedInputs) {
        const z = store.getZone(nodeId, widgetName)
        if (z) zones.set(z, (zones.get(z) ?? 0) + 1)
      }
      // Each input zone should get exactly 1 input (4 inputs / 4 input zones)
      expect(zones.get('z2')).toBeUndefined() // z2 is output zone
      for (const count of zones.values()) {
        expect(count).toBe(1)
      }
    })

    it('skips already-assigned inputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([1, 'a'], [2, 'b'])
      store.setZone(1, 'a', 'z1')
      store.autoAssignInputs()

      expect(store.getZone(1, 'a')).toBe('z1')
      // b should be assigned to some zone (not z1 since z1 already has one)
      expect(store.getZone(2, 'b')).toBeDefined()
    })

    it('handles single input zone', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      // switch to focus template: 2 input zones (side1, side2) + 1 output (main)
      store.switchTemplate('focus')
      store.selectedInputs.push([1, 'a'], [2, 'b'])
      store.autoAssignInputs()

      expect(store.getZone(1, 'a')).toBeDefined()
      expect(store.getZone(2, 'b')).toBeDefined()
    })

    it('does nothing with empty inputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.autoAssignInputs()
      expect(Object.keys(store.zoneAssignments)).toHaveLength(0)
    })
  })

  describe('switchTemplate', () => {
    it('clears stale zone assignments from old template', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([1, 'a'])
      store.setZone(1, 'a', 'sb') // sidebar zone

      store.switchTemplate('focus')

      // 'sb' is not a valid zone in focus template, so assignment should be cleared
      // and autoAssign should have re-assigned it
      const zone = store.getZone(1, 'a')
      expect(zone).toBeDefined()
      expect(zone).not.toBe('sb')
    })

    it('preserves valid zone assignments', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([1, 'a'])
      // grid template has z1-z6
      store.switchTemplate('grid')
      store.setZone(1, 'a', 'z1')

      // Switch to sidebar which also has z1
      store.switchTemplate('sidebar')
      expect(store.getZone(1, 'a')).toBe('z1')
    })

    it('calls autoAssign after clearing', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([1, 'a'])

      store.switchTemplate('grid')
      expect(store.getZone(1, 'a')).toBeDefined()
    })
  })

  describe('outputZoneIds', () => {
    it('returns default isOutput zones when no explicit assignments', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedOutputs.push(1)

      // sidebar template: z2 is the default isOutput zone
      expect(store.outputZoneIds.has('z2')).toBe(true)
      expect(store.outputZoneIds.size).toBe(1)
    })

    it('returns explicit zones when outputs are assigned', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedOutputs.push(1, 2)
      store.setZone(1, '__output__', 'z1')
      store.setZone(2, '__output__', 'z3')

      expect(store.outputZoneIds).toEqual(new Set(['z1', 'z3']))
    })

    it('returns empty set when no template', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.layoutTemplateId =
        'nonexistent' as unknown as typeof store.layoutTemplateId

      expect(store.outputZoneIds.size).toBe(0)
    })

    it('returns default zones when outputs exist but none are assigned', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      // focus template: main is isOutput
      store.switchTemplate('focus')
      store.selectedOutputs.push(1)

      expect(store.outputZoneIds.has('main')).toBe(true)
      expect(store.outputZoneIds.size).toBe(1)
    })
  })

  describe('setZone', () => {
    it('stores assignment and persists', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.setZone(1, 'prompt', 'z1')

      expect(store.getZone(1, 'prompt')).toBe('z1')
      const linearData = app.rootGraph.extra.linearData as Record<
        string,
        unknown
      >
      const perTemplate = linearData?.zoneAssignmentsPerTemplate as Record<
        string,
        Record<string, string>
      >
      expect(perTemplate?.[store.layoutTemplateId]).toHaveProperty(
        '1:prompt',
        'z1'
      )
    })

    it('overwrites previous assignment', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.setZone(1, 'prompt', 'z1')
      store.setZone(1, 'prompt', 'z2')

      expect(store.getZone(1, 'prompt')).toBe('z2')
    })
  })
})
