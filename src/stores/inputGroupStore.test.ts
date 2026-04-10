import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  LinearData,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { extra: {}, nodes: [{ id: 1 }], events: new EventTarget() }
  }
}))

vi.mock('@/utils/litegraphUtil', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveNode: vi.fn<(id: NodeId) => LGraphNode | undefined>(() => undefined)
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({ read_only: false })
  })
}))

vi.mock('@/components/builder/useEmptyWorkflowDialog', () => ({
  useEmptyWorkflowDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn(() => false),
    set: vi.fn()
  })
}))

import { useInputGroupStore } from './inputGroupStore'

function createWorkflow(
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

describe('inputGroupStore', () => {
  let store: ReturnType<typeof useInputGroupStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.mocked(app.rootGraph).extra = {}
    // Set active workflow in builder mode so persistence works
    const workflowStore = useWorkflowStore()
    workflowStore.activeWorkflow = createWorkflow()
    store = useInputGroupStore()
    vi.clearAllMocks()
  })

  describe('createGroup', () => {
    it('creates an empty group with generated id', () => {
      const id = store.createGroup()

      expect(store.inputGroups).toHaveLength(1)
      expect(store.inputGroups[0]).toMatchObject({
        id,
        name: null,
        items: []
      })
    })

    it('creates a group with a name', () => {
      store.createGroup('Dimensions')

      expect(store.inputGroups[0].name).toBe('Dimensions')
    })
  })

  describe('deleteGroup', () => {
    it('removes a group by id', () => {
      const id = store.createGroup()
      store.deleteGroup(id)

      expect(store.inputGroups).toHaveLength(0)
    })

    it('does nothing for unknown id', () => {
      store.createGroup()
      store.deleteGroup('nonexistent')

      expect(store.inputGroups).toHaveLength(1)
    })
  })

  describe('addItemToGroup', () => {
    it('adds an item to a group', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:steps')

      expect(store.inputGroups[0].items).toHaveLength(1)
      expect(store.inputGroups[0].items[0].key).toBe('input:1:steps')
    })

    it('does not add duplicate items', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:steps')
      store.addItemToGroup(id, 'input:1:steps')

      expect(store.inputGroups[0].items).toHaveLength(1)
    })

    it('moves item from one group to another', () => {
      const g1 = store.createGroup()
      const g2 = store.createGroup()
      store.addItemToGroup(g1, 'input:1:steps')
      store.addItemToGroup(g2, 'input:1:steps')

      // g1 was auto-deleted (became empty)
      expect(store.inputGroups).toHaveLength(1)
      expect(store.inputGroups[0].id).toBe(g2)
      expect(store.inputGroups[0].items[0].key).toBe('input:1:steps')
    })
  })

  describe('removeItemFromGroup', () => {
    it('removes an item from a group', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:steps')
      store.addItemToGroup(id, 'input:1:cfg')
      store.removeItemFromGroup(id, 'input:1:steps')

      expect(store.inputGroups[0].items).toHaveLength(1)
      expect(store.inputGroups[0].items[0].key).toBe('input:1:cfg')
    })

    it('deletes group when last item is removed', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:steps')
      store.removeItemFromGroup(id, 'input:1:steps')

      expect(store.inputGroups).toHaveLength(0)
    })

    it('clears pair when paired item is removed', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:width')
      store.addItemToGroup(id, 'input:1:height')
      store.addItemToGroup(id, 'input:1:steps')
      store.pairItemsInGroup(id, 'input:1:width', 'input:1:height')
      store.removeItemFromGroup(id, 'input:1:width')

      const remaining = store.inputGroups[0].items
      expect(remaining.every((i) => i.pairId === undefined)).toBe(true)
    })
  })

  describe('renameGroup', () => {
    it('renames a group', () => {
      const id = store.createGroup()
      store.renameGroup(id, 'Dimensions')

      expect(store.inputGroups[0].name).toBe('Dimensions')
    })

    it('sets name to null to use auto-name', () => {
      const id = store.createGroup('Old Name')
      store.renameGroup(id, null)

      expect(store.inputGroups[0].name).toBeNull()
    })
  })

  describe('reorderWithinGroup', () => {
    it('moves an item before another', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:a')
      store.addItemToGroup(id, 'input:1:b')
      store.addItemToGroup(id, 'input:1:c')

      store.reorderWithinGroup(id, 'input:1:c', 'input:1:a', 'before')

      const keys = store.inputGroups[0].items.map((i) => i.key)
      expect(keys).toEqual(['input:1:c', 'input:1:a', 'input:1:b'])
    })

    it('moves an item after another', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:a')
      store.addItemToGroup(id, 'input:1:b')
      store.addItemToGroup(id, 'input:1:c')

      store.reorderWithinGroup(id, 'input:1:a', 'input:1:c', 'after')

      const keys = store.inputGroups[0].items.map((i) => i.key)
      expect(keys).toEqual(['input:1:b', 'input:1:c', 'input:1:a'])
    })
  })

  describe('pairItemsInGroup / unpairItem', () => {
    it('pairs two items with a shared pairId', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:width')
      store.addItemToGroup(id, 'input:1:height')

      store.pairItemsInGroup(id, 'input:1:width', 'input:1:height')

      const items = store.inputGroups[0].items
      expect(items[0].pairId).toBeDefined()
      expect(items[0].pairId).toBe(items[1].pairId)
    })

    it('unpairs an item and clears partner pairId', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:width')
      store.addItemToGroup(id, 'input:1:height')
      store.pairItemsInGroup(id, 'input:1:width', 'input:1:height')

      store.unpairItem(id, 'input:1:width')

      const items = store.inputGroups[0].items
      expect(items.every((i) => i.pairId === undefined)).toBe(true)
    })
  })

  describe('replaceInPair', () => {
    it('swaps a dragged item into an existing pair slot', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:a')
      store.addItemToGroup(id, 'input:1:b')
      store.addItemToGroup(id, 'input:1:c')
      store.pairItemsInGroup(id, 'input:1:a', 'input:1:b')

      store.replaceInPair(id, 'input:1:b', 'input:1:c')

      const items = store.inputGroups[0].items
      const aItem = items.find((i) => i.key === 'input:1:a')!
      const cItem = items.find((i) => i.key === 'input:1:c')!
      const bItem = items.find((i) => i.key === 'input:1:b')!
      // c took b's pair slot
      expect(cItem.pairId).toBe(aItem.pairId)
      // b is now unpaired
      expect(bItem.pairId).toBeUndefined()
    })

    it('does nothing when target has no pairId', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:a')
      store.addItemToGroup(id, 'input:1:b')

      store.replaceInPair(id, 'input:1:a', 'input:1:b')

      const items = store.inputGroups[0].items
      expect(items.every((i) => i.pairId === undefined)).toBe(true)
    })
  })

  describe('moveItemToGroupAt', () => {
    it('moves item from one group to another before target', () => {
      const g1 = store.createGroup()
      const g2 = store.createGroup()
      store.addItemToGroup(g1, 'input:1:x')
      store.addItemToGroup(g2, 'input:1:a')
      store.addItemToGroup(g2, 'input:1:b')

      store.moveItemToGroupAt(g2, 'input:1:x', 'input:1:a', 'before')

      expect(store.inputGroups).toHaveLength(1)
      const keys = store.inputGroups[0].items.map((i) => i.key)
      expect(keys).toEqual(['input:1:x', 'input:1:a', 'input:1:b'])
    })

    it('moves item after target', () => {
      const g1 = store.createGroup()
      const g2 = store.createGroup()
      store.addItemToGroup(g1, 'input:1:x')
      store.addItemToGroup(g2, 'input:1:a')
      store.addItemToGroup(g2, 'input:1:b')

      store.moveItemToGroupAt(g2, 'input:1:x', 'input:1:a', 'after')

      const keys = store.inputGroups[0].items.map((i) => i.key)
      expect(keys).toEqual(['input:1:a', 'input:1:x', 'input:1:b'])
    })

    it('pairs items when position is center', () => {
      const g1 = store.createGroup()
      const g2 = store.createGroup()
      store.addItemToGroup(g1, 'input:1:x')
      store.addItemToGroup(g2, 'input:1:a')

      store.moveItemToGroupAt(g2, 'input:1:x', 'input:1:a', 'center')

      const items = store.inputGroups[0].items
      expect(items[0].pairId).toBeDefined()
      expect(items[0].pairId).toBe(items[1].pairId)
    })

    it('deletes empty source group', () => {
      const g1 = store.createGroup()
      const g2 = store.createGroup()
      store.addItemToGroup(g1, 'input:1:x')
      store.addItemToGroup(g2, 'input:1:a')

      store.moveItemToGroupAt(g2, 'input:1:x', 'input:1:a', 'before')

      expect(store.inputGroups).toHaveLength(1)
      expect(store.inputGroups[0].id).toBe(g2)
    })
  })

  describe('groupedItemKeys / isGrouped', () => {
    it('tracks which items are in groups', () => {
      const id = store.createGroup()
      store.addItemToGroup(id, 'input:1:steps')

      expect(store.groupedItemKeys.has('input:1:steps')).toBe(true)
      expect(store.isGrouped(1, 'steps')).toBe(true)
      expect(store.isGrouped(1, 'cfg')).toBe(false)
    })
  })

  describe('persistence', () => {
    it('persists groups to linearData on graph extra', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createWorkflow()

      const id = store.createGroup('Test')
      store.addItemToGroup(id, 'input:1:steps')

      const linearData = app.rootGraph.extra.linearData as LinearData
      expect(linearData?.inputGroups).toBeDefined()
      expect(linearData.inputGroups).toHaveLength(1)
      expect(linearData.inputGroups![0].name).toBe('Test')
    })

    it('clears inputGroups from linearData when empty', () => {
      const workflowStore = useWorkflowStore()
      workflowStore.activeWorkflow = createWorkflow()

      const id = store.createGroup()
      store.deleteGroup(id)

      const linearData = app.rootGraph.extra.linearData as LinearData
      expect(linearData?.inputGroups).toBeUndefined()
    })
  })
})
