import { render } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import { defineComponent, nextTick, ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { SlotLayout } from '@/renderer/core/layout/types'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'

import {
  deleteTrackedNodeSlotLayouts,
  syncNodeSlotLayoutsFromDOM,
  flushScheduledSlotLayoutSync,
  requestSlotLayoutSyncForAllNodes,
  useSlotElementTracking
} from './useSlotElementTracking'
import {
  clearViewportVirtualizedNodeIds,
  replaceViewportVirtualizedNodeIds
} from './viewportVirtualizationState'

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

const NODE_ID = toNodeId('test-node')
const SLOT_INDEX = 0

function createTestSetup(type: 'input' | 'output') {
  const el = ref<HTMLElement | null>(null)
  const TestComponent = defineComponent({
    setup() {
      useNodeLayout(NODE_ID)
      useSlotElementTracking({
        nodeId: NODE_ID,
        index: SLOT_INDEX,
        type,
        element: el
      })
      return { el }
    },
    template: '<div />'
  })
  return { el, TestComponent }
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
async function mountAndRegisterSlot(
  type: 'input' | 'output',
  collapsed = false
) {
  const { el, TestComponent } = createTestSetup(type)
  const { unmount } = render(TestComponent)
  el.value = createSlotElement(collapsed)
  await nextTick()
  flushScheduledSlotLayoutSync()
  return { unmount }
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
    clearViewportVirtualizedNodeIds()
  })

  it.for([
    { type: 'input' as const, isInput: true },
    { type: 'output' as const, isInput: false }
  ])('cleans up $type slot layout on unmount', async ({ type, isInput }) => {
    const { unmount } = await mountAndRegisterSlot(type)

    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, isInput)
    const registryStore = useNodeSlotRegistryStore()
    expect(registryStore.getNode(NODE_ID)?.slots.has(slotKey)).toBe(true)
    expect(layoutStore.getSlotLayout(slotKey)).not.toBeNull()

    unmount()

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
    expect(registryStore.getNode(NODE_ID)).toBeUndefined()
  })

  it('retains measured slot geometry across a viewport unmount', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const registryStore = useNodeSlotRegistryStore()
    const initialLayout = layoutStore.getSlotLayout(slotKey)
    expect(initialLayout).not.toBeNull()

    replaceViewportVirtualizedNodeIds([NODE_ID])
    unmount()

    const entry = registryStore.getNode(NODE_ID)?.slots.get(slotKey)
    expect(entry?.el).toBeUndefined()
    expect(layoutStore.getSlotLayout(slotKey)).toEqual(initialLayout)
  })

  it('translates cached geometry while a virtualized node moves', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const initialLayout = layoutStore.getSlotLayout(slotKey)!
    replaceViewportVirtualizedNodeIds([NODE_ID])
    unmount()

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: NODE_ID,
      position: { x: 50, y: 75 },
      previousPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
    await nextTick()

    expect(layoutStore.getSlotLayout(slotKey)?.position).toEqual({
      x: initialLayout.position.x + 50,
      y: initialLayout.position.y + 75
    })
  })

  it.for([
    { state: 'expanded', collapsed: false },
    { state: 'collapsed', collapsed: true }
  ])(
    'translates $state slot geometry after repeated viewport remounts',
    async ({ collapsed }) => {
      let mounted = await mountAndRegisterSlot('input', collapsed)
      const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)

      for (let cycle = 1; cycle <= 2; cycle++) {
        replaceViewportVirtualizedNodeIds([NODE_ID])
        mounted.unmount()
        replaceViewportVirtualizedNodeIds([])

        mounted = await mountAndRegisterSlot('input', collapsed)
        const remountedLayout = layoutStore.getSlotLayout(slotKey)!
        const previousPosition =
          layoutStore.getNodeLayoutRef(NODE_ID).value!.position
        const nextPosition = { x: cycle * 50, y: cycle * 75 }

        layoutStore.batchUpdateNodeBounds([
          {
            nodeId: NODE_ID,
            bounds: {
              ...nextPosition,
              width: 200,
              height: 100
            }
          }
        ])
        await nextTick()

        expect(layoutStore.getSlotLayout(slotKey)?.position).toEqual({
          x: remountedLayout.position.x + nextPosition.x - previousPosition.x,
          y: remountedLayout.position.y + nextPosition.y - previousPosition.y
        })
      }

      mounted.unmount()
    }
  )

  it('translates measured slot geometry while a mounted node moves', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const initialLayout = layoutStore.getSlotLayout(slotKey)!

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: NODE_ID,
      position: { x: 50, y: 75 },
      previousPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
    await nextTick()

    expect(layoutStore.getSlotLayout(slotKey)?.position).toEqual({
      x: initialLayout.position.x + 50,
      y: initialLayout.position.y + 75
    })

    unmount()
  })

  it('drops stale geometry when a moved slot has no cached offset', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const entry = useNodeSlotRegistryStore()
      .getNode(NODE_ID)
      ?.slots.get(slotKey)
    if (!entry) throw new Error('Registered slot entry not found')
    entry.cachedOffset = undefined

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: NODE_ID,
      position: { x: 50, y: 75 },
      previousPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas,
      actor: 'test'
    })
    await nextTick()

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()

    unmount()
  })

  it('remeasures invalidated geometry after a virtualized node resizes', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const registryStore = useNodeSlotRegistryStore()
    replaceViewportVirtualizedNodeIds([NODE_ID])
    unmount()

    layoutStore.applyOperation({
      type: 'resizeNode',
      entity: 'node',
      nodeId: NODE_ID,
      size: { width: 300, height: 200 },
      previousSize: { width: 200, height: 100 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    await nextTick()

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
    expect(
      registryStore.getNode(NODE_ID)?.slots.get(slotKey)?.cachedOffset
    ).toBeUndefined()

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: NODE_ID,
      position: { x: 50, y: 75 },
      previousPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    await nextTick()

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()

    replaceViewportVirtualizedNodeIds([])
    const remounted = await mountAndRegisterSlot('input')
    const remountedLayout = layoutStore.getSlotLayout(slotKey)

    expect(remountedLayout).not.toBeNull()
    expect(layoutStore.getNodeLayoutRef(NODE_ID).value?.size).toEqual({
      width: 300,
      height: 200
    })

    remounted.unmount()
  })

  it('prunes cached geometry when virtualization clears before remount', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    const registryStore = useNodeSlotRegistryStore()
    replaceViewportVirtualizedNodeIds([NODE_ID])
    unmount()
    clearViewportVirtualizedNodeIds()

    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: NODE_ID,
      position: { x: 50, y: 75 },
      previousPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    await nextTick()

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
    expect(registryStore.getNode(NODE_ID)).toBeUndefined()
  })

  it('clears retained geometry on real node deletion', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    replaceViewportVirtualizedNodeIds([NODE_ID])
    unmount()

    deleteTrackedNodeSlotLayouts(NODE_ID)

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
    expect(useNodeSlotRegistryStore().getNode(NODE_ID)).toBeUndefined()
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

  it('uses a matching node container when a foreign slot entry comes first', () => {
    const foreignContainer = document.createElement('div')
    foreignContainer.dataset.nodeId = 'other-node'
    document.body.appendChild(foreignContainer)

    const foreignSlot = document.createElement('div')
    foreignContainer.appendChild(foreignSlot)

    const matchingSlot = createSlotElement()
    const foreignSlotKey = getSlotKey(NODE_ID, 0, true)
    const matchingSlotKey = getSlotKey(NODE_ID, 1, false)
    const node = useNodeSlotRegistryStore().ensureNode(NODE_ID)
    node.slots.set(foreignSlotKey, {
      el: foreignSlot,
      index: 0,
      type: 'input'
    })
    node.slots.set(matchingSlotKey, {
      el: matchingSlot,
      index: 1,
      type: 'output'
    })

    syncNodeSlotLayoutsFromDOM(NODE_ID)

    expect(layoutStore.getSlotLayout(matchingSlotKey)?.position).toEqual({
      x: 15,
      y: 35 - LiteGraph.NODE_TITLE_HEIGHT
    })
    expect(layoutStore.getSlotLayout(foreignSlotKey)).toBeNull()
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

    it('caches collapsed slot offsets relative to the node position', () => {
      const { slotKey, node } = registerCollapsedSlot()
      const entry = node.slots.get(slotKey)!
      expect(entry.cachedOffset).toBeDefined()

      syncNodeSlotLayoutsFromDOM(NODE_ID)

      expect(entry.cachedOffset).toEqual({ x: 7.5, y: 17.5 })
    })

    it('translates collapsed slot geometry while the node moves', async () => {
      const { unmount } = await mountAndRegisterSlot('input', true)
      const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
      const initialLayout = layoutStore.getSlotLayout(slotKey)!

      layoutStore.applyOperation({
        type: 'moveNode',
        entity: 'node',
        nodeId: NODE_ID,
        position: { x: 50, y: 75 },
        previousPosition: { x: 0, y: 0 },
        timestamp: Date.now(),
        source: LayoutSource.Vue,
        actor: 'test'
      })
      await nextTick()

      expect(layoutStore.getSlotLayout(slotKey)?.position).toEqual({
        x: initialLayout.position.x + 50,
        y: initialLayout.position.y + 75
      })

      unmount()
    })

    it('defers sync when canvas is not initialized', () => {
      mockCanvasState.canvas = null
      registerCollapsedSlot()

      syncNodeSlotLayoutsFromDOM(NODE_ID)

      expect(mockClientPosToCanvasPos).not.toHaveBeenCalled()
    })
  })
})
