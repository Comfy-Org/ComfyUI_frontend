import { render } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toNodeId } from '@/types/nodeId'
import { defineComponent, nextTick, ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { SlotLayout } from '@/renderer/core/layout/types'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'

import {
  deleteTrackedNodeSlots,
  reconcileTrackedNodeSlots
} from '@/renderer/extensions/vueNodes/utils/slotLayoutCache'

import {
  syncNodeSlotLayoutsFromDOM,
  flushScheduledSlotLayoutSync,
  requestSlotLayoutSyncForAllNodes,
  useSlotElementTracking
} from './useSlotElementTracking'

const mockGraph = vi.hoisted(() => ({ _nodes: [] as unknown[] }))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: mockGraph, setDirty: vi.fn() } }
}))

const NODE_ID = toNodeId('test-node')
const SLOT_INDEX = 0

function createTestSetup(type: 'input' | 'output') {
  const el = ref<HTMLElement | null>(null)
  const TestComponent = defineComponent({
    setup() {
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

function createSlotElement(
  collapsed = false,
  rects?: { node?: DOMRect; slot?: DOMRect }
): HTMLElement {
  const container = document.createElement('div')
  container.dataset.nodeId = NODE_ID
  if (collapsed) container.dataset.collapsed = ''
  container.getBoundingClientRect = () =>
    rects?.node ??
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
    } as DOMRect)
  document.body.appendChild(container)

  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    rects?.slot ??
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
    } as DOMRect)
  container.appendChild(el)

  return el
}

/**
 * Mount the wrapper, set the element ref, and wait for slot registration.
 */
async function mountAndRegisterSlot(
  type: 'input' | 'output',
  rects?: { node?: DOMRect; slot?: DOMRect }
) {
  const { el, TestComponent } = createTestSetup(type)
  const { unmount } = render(TestComponent)
  el.value = createSlotElement(false, rects)
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
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it.for([
    { type: 'input' as const, isInput: true },
    { type: 'output' as const, isInput: false }
  ])(
    'retains $type slot layout on virtualized unmount',
    async ({ type, isInput }) => {
      const { unmount } = await mountAndRegisterSlot(type)

      const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, isInput)
      const registryStore = useNodeSlotRegistryStore()
      expect(registryStore.getNode(NODE_ID)?.slots.has(slotKey)).toBe(true)
      expect(layoutStore.getSlotLayout(slotKey)).not.toBeNull()

      unmount()

      expect(layoutStore.getSlotLayout(slotKey)).not.toBeNull()
      expect(
        registryStore.getNode(NODE_ID)?.slots.get(slotKey)?.el
      ).toBeUndefined()
    }
  )

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

  it('clears pendingSlotSync when graph nodes have no measured slots', () => {
    // No slot layouts exist (simulates initial mount before Vue registers slots)
    layoutStore.setPendingSlotSync(true)

    flushScheduledSlotLayoutSync()

    expect(layoutStore.pendingSlotSync).toBe(false)
  })

  it('clears pendingSlotSync when all registered slots are detached', () => {
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

    expect(layoutStore.pendingSlotSync).toBe(false)
    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
  })

  it('retains slot layouts when slot elements detach', () => {
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

    expect(layoutStore.getSlotLayout(slotKey)).toEqual(staleLayout)
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

  it('updates retained slot layouts while an offscreen node moves', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)

    unmount()
    layoutStore.applyOperation({
      type: 'moveNode',
      entity: 'node',
      nodeId: NODE_ID,
      position: { x: 100, y: 200 },
      previousPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      source: LayoutSource.External,
      actor: 'test'
    })
    await nextTick()

    expect(layoutStore.getSlotLayout(slotKey)?.position).toEqual({
      x: 115,
      y: 205
    })
  })

  it('reattaches and remeasures a retained slot', async () => {
    const first = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    first.unmount()

    const second = await mountAndRegisterSlot('input', {
      slot: new DOMRect(30, 50, 10, 10)
    })
    const entry = useNodeSlotRegistryStore()
      .getNode(NODE_ID)
      ?.slots.get(slotKey)

    expect(entry?.el?.isConnected).toBe(true)
    expect(layoutStore.getSlotLayout(slotKey)?.position).toEqual({
      x: 35,
      y: 25
    })
    second.unmount()
  })

  it('removes retained layouts when the slot model deletes a slot', async () => {
    const { unmount } = await mountAndRegisterSlot('input')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
    unmount()

    reconcileTrackedNodeSlots(NODE_ID, 0, 0)

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
    expect(
      useNodeSlotRegistryStore().getNode(NODE_ID)?.slots.has(slotKey)
    ).toBe(false)
  })

  it('invalidates retained offsets when a slot direction shrinks', () => {
    const inputKey0 = getSlotKey(NODE_ID, 0, true)
    const inputKey1 = getSlotKey(NODE_ID, 1, true)
    const outputKey = getSlotKey(NODE_ID, 0, false)
    const node = useNodeSlotRegistryStore().ensureNode(NODE_ID)
    node.slots.set(inputKey0, {
      index: 0,
      type: 'input',
      cachedOffset: { x: 10, y: 20 }
    })
    node.slots.set(inputKey1, {
      index: 1,
      type: 'input',
      cachedOffset: { x: 30, y: 40 }
    })
    node.slots.set(outputKey, {
      index: 0,
      type: 'output',
      cachedOffset: { x: 50, y: 60 }
    })

    reconcileTrackedNodeSlots(NODE_ID, 1, 1)

    expect(node.slots.has(inputKey1)).toBe(false)
    expect(node.slots.get(inputKey0)?.cachedOffset).toBeUndefined()
    expect(node.slots.get(outputKey)?.cachedOffset).toEqual({ x: 50, y: 60 })
  })

  it('clears retained layouts when the graph deletes a node', async () => {
    const { unmount } = await mountAndRegisterSlot('output')
    const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, false)
    unmount()

    deleteTrackedNodeSlots(NODE_ID)

    expect(layoutStore.getSlotLayout(slotKey)).toBeNull()
    expect(useNodeSlotRegistryStore().getNode(NODE_ID)).toBeUndefined()
  })

  describe('collapsed node slot sync', () => {
    function registerCollapsedSlot() {
      const slotKey = getSlotKey(NODE_ID, SLOT_INDEX, true)
      const slotEl = createSlotElement(true, {
        node: {
          left: 200,
          top: 340,
          right: 360,
          bottom: 400,
          width: 160,
          height: 60,
          x: 200,
          y: 340,
          toJSON: () => ({})
        } as DOMRect,
        slot: {
          left: 197,
          top: 367,
          right: 203,
          bottom: 373,
          width: 6,
          height: 6,
          x: 197,
          y: 367,
          toJSON: () => ({})
        } as DOMRect
      })

      layoutStore.applyOperation({
        type: 'moveNode',
        entity: 'node',
        nodeId: NODE_ID,
        position: { x: 100, y: 200 },
        previousPosition: { x: 0, y: 0 },
        timestamp: Date.now(),
        source: LayoutSource.External,
        actor: 'test'
      })
      layoutStore.batchUpdateNodeBounds([
        {
          nodeId: NODE_ID,
          bounds: { x: 100, y: 200, width: 80, height: 0 }
        }
      ])

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

    it('measures collapsed slots relative to rendered bounds', () => {
      const { slotKey, node } = registerCollapsedSlot()

      syncNodeSlotLayoutsFromDOM(NODE_ID)

      // The collapsed DOM is 160px wide for an 80-canvas-unit bound, so the
      // effective scale is 2. The slot center is on the left edge and 15
      // canvas units above node.position.y after accounting for title height.
      const layout = layoutStore.getSlotLayout(slotKey)
      expect(layout?.position).toEqual({ x: 100, y: 185 })
      expect(node.slots.get(slotKey)?.cachedOffset).toEqual({ x: 0, y: -15 })
    })
  })
})
