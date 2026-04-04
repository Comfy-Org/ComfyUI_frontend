import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { SlotLayout } from '@/renderer/core/layout/types'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'

import {
  syncNodeSlotLayoutsFromDOM,
  flushScheduledSlotLayoutSync,
  requestSlotLayoutSyncForAllNodes,
  useSlotElementTracking
} from './useSlotElementTracking'

const mockGraph = vi.hoisted(() => ({ _nodes: [] as unknown[] }))
const mockCanvasState = vi.hoisted(() => ({
  canvas: {} as object | null
}))
const mockClientPosToCanvasPos = vi.hoisted(() =>
  vi.fn(([x, y]: [number, number]) => [x * 0.5, y * 0.5] as [number, number])
)

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: mockGraph, setDirty: vi.fn() } }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasState
}))

vi.mock('@/composables/element/useCanvasPositionConversion', () => ({
  useSharedCanvasPositionConversion: () => ({
    clientPosToCanvasPos: mockClientPosToCanvasPos
  })
}))

const NODE_ID = 'test-node'
const SLOT_INDEX = 0

function createWrapperComponent(type: 'input' | 'output') {
  return defineComponent({
    setup() {
      const el = ref<HTMLElement | null>(null)
      useSlotElementTracking({
        nodeId: NODE_ID,
        index: SLOT_INDEX,
        type,
        element: el
      })
      return { el }
    },
    // No template ref — el starts null so the immediate watcher doesn't fire
    // before the stop handle is assigned
    template: '<div />'
  })
}

function createSlotElement(collapsed = false): HTMLElement {
  const container = document.createElement('div')
  container.dataset.nodeId = NODE_ID
  if (collapsed) container.dataset.collapsed = ''
  container.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }) as DOMRect
  document.body.appendChild(container)

  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 30,
      right: 20,
      bottom: 40,
      width: 10,
      height: 10,
      x: 10,
      y: 30,
      toJSON: () => ({})
    }) as DOMRect
  container.appendChild(el)

  return el
}

/**
 * Mount the wrapper, set the element ref, and wait for slot registration.
 */
async function mountAndRegisterSlot(type: 'input' | 'output') {
  const wrapper = mount(createWrapperComponent(type))
  wrapper.vm.el = createSlotElement()
  await nextTick()
  flushScheduledSlotLayoutSync()
  return wrapper
}

describe('useSlotElementTracking', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    document.body.innerHTML = ''
    layoutStore.initializeFromLiteGraph([])
    layoutStore.applyOperation({
      type: 'createNode',
      entity: 'node',
      nodeId: NODE_ID,
      layout: {
        id: NODE_ID,
        position: { x: 0, y: 0 },
        size: { width: 200, height: 100 },
        zIndex: 0,
        visible: true,
        bounds: { x: 0, y: 0, width: 200, height: 100 }
      },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    mockGraph._nodes = [{ id: 1 }]
    mockCanvasState.canvas = {}
    mockClientPosToCanvasPos.mockClear()
  })

  it.each([
    { type: 'input' as const, isInput: true },
    { type: 'output' as const, isInput: false }
  ])('cleans up $type slot layout on unmount', async ({ type, isInput }) => {
    const wrapper = await mountAndRegisterSlot(type)

    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, isInput)
    const registryStore = useNodeSlotRegistryStore()
    expect(registryStore.getNode(NODE_ID)?.slots.has(slotKey)).toBe(true)
    expect(layoutStore.getSlotLayout(slotKey)).not.toBeNull()

    wrapper.unmount()

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
    expect(registryStore.getNode(NODE_ID)).toBeUndefined()
  })

  it('clears pendingSlotSync when slot layouts already exist', () => {
    // Seed a slot layout (simulates slot layouts persisting through undo/redo)
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const slotLayout: SlotLayout = {
      nodeId: NODE_ID,
      index: 0,
      type: 'input',
      position: { x: 0, y: 0 },
      bounds: { x: 0, y: 0, width: 10, height: 10 }
    }
    layoutStore.batchUpdateSlotLayouts([{ key: slotKey, layout: slotLayout }])

    // Simulate what app.ts onConfigure does: set pending, then flush
    layoutStore.setPendingSlotSync(true)
    expect(layoutStore.pendingSlotSync).toBe(true)

    // No slots were scheduled (undo/redo — onMounted didn't fire),
    // but slot layouts already exist. Flush should clear the flag.
    flushScheduledSlotLayoutSync()

    expect(layoutStore.pendingSlotSync).toBe(false)
  })

  it('keeps pendingSlotSync when graph has nodes but no slot layouts', () => {
    // No slot layouts exist (simulates initial mount before Vue registers slots)
    layoutStore.setPendingSlotSync(true)

    flushScheduledSlotLayoutSync()

    // Should remain pending — waiting for Vue components to mount
    expect(layoutStore.pendingSlotSync).toBe(true)
  })

  it('keeps pendingSlotSync when all registered slots are hidden', () => {
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const hiddenSlot = document.createElement('div')

    const registryStore = useNodeSlotRegistryStore()
    const node = registryStore.ensureNode(NODE_ID)
    node.slots.set(slotKey, {
      el: hiddenSlot,
      index: SLOT_INDEX,
      type: 'input'
    })

    layoutStore.setPendingSlotSync(true)
    requestSlotLayoutSyncForAllNodes()

    expect(layoutStore.pendingSlotSync).toBe(true)
    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
  })

  it('removes stale slot layouts when slot element is hidden', () => {
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const hiddenSlot = document.createElement('div')

    const staleLayout: SlotLayout = {
      nodeId: NODE_ID,
      index: SLOT_INDEX,
      type: 'input',
      position: { x: 10, y: 20 },
      bounds: { x: 6, y: 16, width: 8, height: 8 }
    }
    layoutStore.batchUpdateSlotLayouts([{ key: slotKey, layout: staleLayout }])

    const registryStore = useNodeSlotRegistryStore()
    const node = registryStore.ensureNode(NODE_ID)
    node.slots.set(slotKey, {
      el: hiddenSlot,
      index: SLOT_INDEX,
      type: 'input'
    })

    syncNodeSlotLayoutsFromDOM(NODE_ID)

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
  })

  it('skips slot layout writeback when measured slot geometry is unchanged', () => {
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const slotEl = createSlotElement()

    const registryStore = useNodeSlotRegistryStore()
    const node = registryStore.ensureNode(NODE_ID)

    const expectedX = 15
    const expectedY = 35 - LiteGraph.NODE_TITLE_HEIGHT

    node.slots.set(slotKey, {
      el: slotEl,
      index: SLOT_INDEX,
      type: 'input',
      cachedOffset: { x: expectedX, y: expectedY }
    })

    const slotSize = LiteGraph.NODE_SLOT_HEIGHT
    const halfSlotSize = slotSize / 2
    const initialLayout: SlotLayout = {
      nodeId: NODE_ID,
      index: SLOT_INDEX,
      type: 'input',
      position: { x: expectedX, y: expectedY },
      bounds: {
        x: expectedX - halfSlotSize,
        y: expectedY - halfSlotSize,
        width: slotSize,
        height: slotSize
      }
    }
    layoutStore.batchUpdateSlotLayouts([
      { key: slotKey, layout: initialLayout }
    ])

    const batchUpdateSpy = vi.spyOn(layoutStore, 'batchUpdateSlotLayouts')

    syncNodeSlotLayoutsFromDOM(NODE_ID)

    expect(batchUpdateSpy).not.toHaveBeenCalled()
  })

  describe('collapsed node slot sync', () => {
    function registerCollapsedSlot() {
      const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
      const slotEl = createSlotElement(true)

      const registryStore = useNodeSlotRegistryStore()
      const node = registryStore.ensureNode(NODE_ID)
      node.slots.set(slotKey, {
        el: slotEl,
        index: SLOT_INDEX,
        type: 'input',
        cachedOffset: { x: 50, y: 60 }
      })

      return { slotKey, node }
    }

    it('uses clientPosToCanvasPos for collapsed nodes', () => {
      const { slotKey } = registerCollapsedSlot()

      syncNodeSlotLayoutsFromDOM(NODE_ID)

      // Slot element center: (10 + 10/2, 30 + 10/2) = (15, 35)
      const screenCenter: [number, number] = [15, 35]
      expect(mockClientPosToCanvasPos).toHaveBeenCalledWith(screenCenter)

      // Mock returns x*0.5, y*0.5
      const layout = layoutStore.getSlotLayout(slotKey)
      expect(layout).not.toBeNull()
      expect(layout!.position.x).toBe(screenCenter[0] * 0.5)
      expect(layout!.position.y).toBe(screenCenter[1] * 0.5)
    })

    it('clears cachedOffset for collapsed nodes', () => {
      const { slotKey, node } = registerCollapsedSlot()
      const entry = node.slots.get(slotKey)!
      expect(entry.cachedOffset).toBeDefined()

      syncNodeSlotLayoutsFromDOM(NODE_ID)

      expect(entry.cachedOffset).toBeUndefined()
    })

    it('defers sync when canvas is not initialized', () => {
      mockCanvasState.canvas = null
      registerCollapsedSlot()

      syncNodeSlotLayoutsFromDOM(NODE_ID)

      expect(mockClientPosToCanvasPos).not.toHaveBeenCalled()
    })
  })
})
