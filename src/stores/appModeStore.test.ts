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
    rootGraph: { extra: {}, nodes: [{ id: 1 }], events: new EventTarget() }
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

vi.mock('@vueuse/core', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>
  return { ...mod, useEventListener: vi.fn() }
})

const mockSettings = vi.hoisted(() => {
  const store: Record<string, unknown> = {}
  return {
    store,
    get: vi.fn((key: string) => store[key] ?? false),
    set: vi.fn(async (key: string, value: unknown) => {
      store[key] = value
    }),
    reset() {
      for (const key of Object.keys(store)) delete store[key]
    }
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettings
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
    mockSettings.reset()
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

    it('reloads selections on configured event', async () => {
      const node1 = mockNode(1)

      // Initially nodes are not resolvable — pruning removes them
      mockResolveNode.mockReturnValue(undefined)
      const inputs: [number, string][] = [[1, 'seed']]
      workflowStore.activeWorkflow = workflowWithLinearData(inputs, [1])
      store.loadSelections({ inputs })
      await nextTick()

      expect(store.selectedInputs).toEqual([])
      expect(store.selectedOutputs).toEqual([])

      // After graph configures, nodes become resolvable
      mockResolveNode.mockImplementation((id) =>
        id == 1 ? (node1 as unknown as LGraphNode) : undefined
      )
      ;(app.rootGraph.events as EventTarget).dispatchEvent(
        new Event('configured')
      )
      await nextTick()

      expect(store.selectedInputs).toEqual([[1, 'seed']])
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
        layoutTemplateId: 'single',
        zoneAssignmentsPerTemplate: {},
        gridOverridesPerTemplate: {},
        runControlsZoneIdPerTemplate: {},
        presetStripZoneIdPerTemplate: {},
        zoneItemOrderPerTemplate: {},

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

    it('calls checkState when input is selected', async () => {
      const workflow = createBuilderWorkflow()
      workflowStore.activeWorkflow = workflow
      await nextTick()
      vi.mocked(workflow.changeTracker!.checkState).mockClear()

      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      expect(workflow.changeTracker!.checkState).toHaveBeenCalled()
    })

    it('calls checkState when input is deselected', async () => {
      const workflow = createBuilderWorkflow()
      workflowStore.activeWorkflow = workflow
      store.selectedInputs.push([42, 'prompt'])
      await nextTick()
      vi.mocked(workflow.changeTracker!.checkState).mockClear()

      store.selectedInputs.splice(0, 1)
      await nextTick()

      expect(workflow.changeTracker!.checkState).toHaveBeenCalled()
    })

    it('reflects input changes in linearData', async () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      await nextTick()

      store.selectedInputs.push([42, 'prompt'])
      await nextTick()

      expect(app.rootGraph.extra.linearData).toEqual({
        inputs: [[42, 'prompt']],
        outputs: [],
        layoutTemplateId: 'single',
        zoneAssignmentsPerTemplate: {},
        gridOverridesPerTemplate: {},
        runControlsZoneIdPerTemplate: {},
        presetStripZoneIdPerTemplate: {},
        zoneItemOrderPerTemplate: {},

        widgetOverrides: undefined,
        presets: undefined,
        presetDisplayMode: undefined
      })
    })
  })

  describe('autoAssignInputs', () => {
    it('distributes inputs evenly across dual template zones', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.switchTemplate('dual')
      store.selectedInputs.push([1, 'a'], [2, 'b'], [3, 'c'], [4, 'd'])
      store.autoAssignInputs()

      const zones = new Map<string, number>()
      for (const [nodeId, widgetName] of store.selectedInputs) {
        const z = store.getZone(nodeId, widgetName)
        if (z) zones.set(z, (zones.get(z) ?? 0) + 1)
      }
      // 4 inputs / 2 zones = 2 each
      expect(zones.get('left')).toBe(2)
      expect(zones.get('right')).toBe(2)
    })

    it('skips already-assigned inputs', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.switchTemplate('dual')
      store.selectedInputs.push([1, 'a'], [2, 'b'])
      store.setZone(1, 'a', 'left')
      store.autoAssignInputs()

      expect(store.getZone(1, 'a')).toBe('left')
      expect(store.getZone(2, 'b')).toBeDefined()
    })

    it('assigns all to single zone in single template', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([1, 'a'], [2, 'b'])
      store.autoAssignInputs()

      expect(store.getZone(1, 'a')).toBe('main')
      expect(store.getZone(2, 'b')).toBe('main')
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
      store.switchTemplate('dual')
      store.selectedInputs.push([1, 'a'])
      store.setZone(1, 'a', 'right')

      store.switchTemplate('single')

      // 'right' is not a valid zone in single template, so cleared + re-assigned
      const zone = store.getZone(1, 'a')
      expect(zone).toBeDefined()
      expect(zone).not.toBe('right')
    })

    it('preserves valid zone assignments across templates with shared zone ids', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.switchTemplate('dual')
      store.selectedInputs.push([1, 'a'])
      store.setZone(1, 'a', 'left')

      // Switch back to dual — 'left' is still valid
      store.switchTemplate('single')
      store.switchTemplate('dual')
      expect(store.getZone(1, 'a')).toBe('left')
    })

    it('calls autoAssign after clearing', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      store.selectedInputs.push([1, 'a'])

      store.switchTemplate('dual')
      expect(store.getZone(1, 'a')).toBeDefined()
    })
  })

  describe('getZoneItems', () => {
    it('returns default order: outputs then inputs then run-controls', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const result = store.getZoneItems(
        'z1',
        [{ nodeId: 10 }],
        [{ nodeId: 20, widgetName: 'seed' }],
        true
      )
      expect(result).toEqual(['output:10', 'input:20:seed', 'run-controls'])
    })

    it('includes preset-strip when requested', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const result = store.getZoneItems('z1', [{ nodeId: 10 }], [], false, true)
      expect(result[0]).toBe('preset-strip')
    })

    it('omits run-controls when not requested', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const result = store.getZoneItems('z1', [], [], false)
      expect(result).not.toContain('run-controls')
    })

    it('returns empty array when no items', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const result = store.getZoneItems('z1', [], [], false, false)
      expect(result).toEqual([])
    })

    it('restores saved order after reorder', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const outputs = [{ nodeId: 1 }, { nodeId: 2 }]
      const widgets = [{ nodeId: 3, widgetName: 'cfg' }]

      // First call establishes default order
      const initial = store.getZoneItems('z1', outputs, widgets, true)
      expect(initial).toEqual([
        'output:1',
        'output:2',
        'input:3:cfg',
        'run-controls'
      ])

      // Reorder: move run-controls before output:1
      store.reorderZoneItem('z1', 'run-controls', 'output:1', 'before', initial)

      // Subsequent call should return saved order, not default
      const restored = store.getZoneItems('z1', outputs, widgets, true)
      expect(restored).toEqual([
        'run-controls',
        'output:1',
        'output:2',
        'input:3:cfg'
      ])
    })

    it('filters stale keys from saved order and appends new ones', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const outputs = [{ nodeId: 1 }]
      const widgets = [{ nodeId: 2, widgetName: 'seed' }]

      // Establish and save an order
      const initial = store.getZoneItems('z1', outputs, widgets, true)
      store.reorderZoneItem('z1', 'run-controls', 'output:1', 'before', initial)

      // Now call with different items (node 2 removed, node 3 added)
      const newOutputs = [{ nodeId: 1 }]
      const newWidgets = [{ nodeId: 3, widgetName: 'steps' }]
      const result = store.getZoneItems('z1', newOutputs, newWidgets, true)

      // Saved order preserved for surviving keys, stale removed, new appended
      expect(result).toEqual(['run-controls', 'output:1', 'input:3:steps'])
    })
  })

  describe('reorderZoneItem', () => {
    const outputs = [{ nodeId: 1 }, { nodeId: 2 }]
    const widgets = [{ nodeId: 3, widgetName: 'steps' }]

    it('moves item before target', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const order = ['output:1', 'output:2', 'input:3:steps']
      store.reorderZoneItem('z1', 'input:3:steps', 'output:1', 'before', order)

      const result = store.getZoneItems('z1', outputs, widgets, false)
      expect(result).toEqual(['input:3:steps', 'output:1', 'output:2'])
    })

    it('moves item after target', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const order = ['output:1', 'output:2', 'input:3:steps']
      store.reorderZoneItem('z1', 'output:1', 'input:3:steps', 'after', order)

      const result = store.getZoneItems('z1', outputs, widgets, false)
      expect(result).toEqual(['output:2', 'input:3:steps', 'output:1'])
    })

    it('does not modify order when fromKey equals toKey', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const order = ['output:1', 'output:2', 'input:3:steps']
      store.reorderZoneItem('z1', 'output:1', 'output:1', 'before', order)

      // getZoneItems should return default order since no saved order was created
      const result = store.getZoneItems('z1', outputs, widgets, false)
      expect(result).toEqual(['output:1', 'output:2', 'input:3:steps'])
    })

    it('does not modify order when key is not in order', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const order = ['output:1', 'output:2', 'input:3:steps']
      store.reorderZoneItem('z1', 'output:99', 'output:1', 'before', order)

      const result = store.getZoneItems('z1', outputs, widgets, false)
      expect(result).toEqual(['output:1', 'output:2', 'input:3:steps'])
    })
  })

  describe('moveWidgetItem', () => {
    it('moves item from zone to group', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const widgets = [
        { nodeId: 1, widgetName: 'steps' },
        { nodeId: 2, widgetName: 'cfg' }
      ]
      // Establish zone order
      store.getZoneItems('z1', [], widgets, false)
      store.reorderZoneItem('z1', 'input:1:steps', 'input:2:cfg', 'before', [
        'input:1:steps',
        'input:2:cfg'
      ])
      const groupId = store.createGroup('z1')

      store.moveWidgetItem('input:1:steps', {
        kind: 'group',
        zoneId: 'z1',
        groupId
      })

      const group = store.inputGroups.find((g) => g.id === groupId)
      expect(group?.items).toHaveLength(1)
      expect(group?.items[0].key).toBe('input:1:steps')
      // Item should no longer be in the zone order
      const order = store.getZoneItems('z1', [], widgets, false)
      expect(order).not.toContain('input:1:steps')
      expect(order).toContain(`group:${groupId}`)
    })

    it('moves item from group back to zone', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const widgets = [
        { nodeId: 1, widgetName: 'steps' },
        { nodeId: 2, widgetName: 'cfg' }
      ]
      store.reorderZoneItem('z1', 'input:1:steps', 'input:2:cfg', 'before', [
        'input:1:steps',
        'input:2:cfg'
      ])
      const groupId = store.createGroup('z1')
      store.addItemToGroup(groupId, 'input:1:steps', 'z1')

      store.moveWidgetItem('input:1:steps', {
        kind: 'zone-relative',
        zoneId: 'z1',
        targetKey: 'input:2:cfg',
        edge: 'before'
      })

      // Group should be deleted (was emptied)
      expect(store.inputGroups.find((g) => g.id === groupId)).toBeUndefined()
      const order = store.getZoneItems('z1', [], widgets, false)
      expect(order).toContain('input:1:steps')
    })

    it('reorders within same group without duplication', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const groupId = store.createGroup('z1')
      store.addItemToGroup(groupId, 'input:1:steps', 'z1')
      store.addItemToGroup(groupId, 'input:2:cfg', 'z1')

      store.moveWidgetItem('input:2:cfg', {
        kind: 'group-relative',
        zoneId: 'z1',
        groupId,
        targetKey: 'input:1:steps',
        edge: 'before'
      })

      const group = store.inputGroups.find((g) => g.id === groupId)
      expect(group?.items).toHaveLength(2)
      expect(group?.items[0].key).toBe('input:2:cfg')
      expect(group?.items[1].key).toBe('input:1:steps')
    })

    it('creates paired group from zone-pair drop', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const widgets = [
        { nodeId: 1, widgetName: 'steps' },
        { nodeId: 2, widgetName: 'cfg' }
      ]
      store.reorderZoneItem('z1', 'input:1:steps', 'input:2:cfg', 'before', [
        'input:1:steps',
        'input:2:cfg'
      ])

      store.moveWidgetItem('input:2:cfg', {
        kind: 'zone-pair',
        zoneId: 'z1',
        targetKey: 'input:1:steps'
      })

      expect(store.inputGroups).toHaveLength(1)
      const group = store.inputGroups[0]
      expect(group.items).toHaveLength(2)
      expect(group.items[0].pairId).toBeDefined()
      expect(group.items[0].pairId).toBe(group.items[1].pairId)
      // Both items should be out of the zone order
      const order = store.getZoneItems('z1', [], widgets, false)
      expect(order).not.toContain('input:1:steps')
      expect(order).not.toContain('input:2:cfg')
      expect(order).toContain(`group:${group.id}`)
    })

    it('adds 3rd item to group via group-relative', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const groupId = store.createGroup('z1')
      store.addItemToGroup(groupId, 'input:1:steps', 'z1')
      store.addItemToGroup(groupId, 'input:2:cfg', 'z1')

      store.moveWidgetItem('input:3:seed', {
        kind: 'group-relative',
        zoneId: 'z1',
        groupId,
        targetKey: 'input:2:cfg',
        edge: 'after'
      })

      const group = store.inputGroups.find((g) => g.id === groupId)
      expect(group?.items).toHaveLength(3)
      expect(group?.items[2].key).toBe('input:3:seed')
    })

    it('dropping into empty group keeps the group', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const widgets = [
        { nodeId: 1, widgetName: 'steps' },
        { nodeId: 2, widgetName: 'cfg' }
      ]
      // Establish zone order so items exist
      store.reorderZoneItem('z1', 'input:1:steps', 'input:2:cfg', 'before', [
        'input:1:steps',
        'input:2:cfg'
      ])
      // Create empty group via + button
      const groupId = store.createGroup('z1')
      expect(store.inputGroups.find((g) => g.id === groupId)).toBeDefined()
      expect(store.getZoneItems('z1', [], widgets, false)).toContain(
        `group:${groupId}`
      )

      // Drop item into the empty group
      store.moveWidgetItem('input:1:steps', {
        kind: 'group',
        zoneId: 'z1',
        groupId
      })

      // Group must still exist with the item
      const group = store.inputGroups.find((g) => g.id === groupId)
      expect(group).toBeDefined()
      expect(group?.items).toHaveLength(1)
      expect(group?.items[0].key).toBe('input:1:steps')
      // Group key must still be in zone order
      const order = store.getZoneItems('z1', [], widgets, false)
      expect(order).toContain(`group:${groupId}`)
      // The moved item must NOT appear as a top-level zone item
      expect(order).not.toContain('input:1:steps')
    })

    it('getZoneItems never returns duplicates', () => {
      workflowStore.activeWorkflow = createBuilderWorkflow()
      const widgets = [{ nodeId: 1, widgetName: 'steps' }]
      // Manually inject duplicate into zone order
      store.reorderZoneItem('z1', 'input:1:steps', 'input:1:steps', 'before', [
        'input:1:steps',
        'input:1:steps'
      ])
      const result = store.getZoneItems('z1', [], widgets, false)
      const counts = result.reduce(
        (acc, k) => {
          acc[k] = (acc[k] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
      for (const [key, count] of Object.entries(counts)) {
        expect(count, `${key} appears ${count} times`).toBe(1)
      }
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

  describe('autoEnableVueNodes', () => {
    it('enables Vue nodes when entering select mode with them disabled', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(mockSettings.set).toHaveBeenCalledWith(
        'Comfy.VueNodes.Enabled',
        true
      )
    })

    it('does not enable Vue nodes when already enabled', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = true
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(mockSettings.set).not.toHaveBeenCalledWith(
        'Comfy.VueNodes.Enabled',
        expect.anything()
      )
    })

    it('shows popup when Vue nodes are switched on and not dismissed', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      mockSettings.store['Comfy.AppBuilder.VueNodeSwitchDismissed'] = false
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(store.showVueNodeSwitchPopup).toBe(true)
    })

    it('does not show popup when previously dismissed', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      mockSettings.store['Comfy.AppBuilder.VueNodeSwitchDismissed'] = true
      workflowStore.activeWorkflow = createBuilderWorkflow('graph')

      store.enterBuilder()
      await nextTick()

      expect(store.showVueNodeSwitchPopup).toBe(false)
    })

    it('does not enable Vue nodes when entering builder:arrange', async () => {
      mockSettings.store['Comfy.VueNodes.Enabled'] = false
      workflowStore.activeWorkflow = createBuilderWorkflow('app')
      store.selectedOutputs.push(1)

      store.enterBuilder()
      await nextTick()

      expect(workflowStore.activeWorkflow!.activeMode).toBe('builder:arrange')
      expect(mockSettings.set).not.toHaveBeenCalledWith(
        'Comfy.VueNodes.Enabled',
        expect.anything()
      )
    })
  })
})
