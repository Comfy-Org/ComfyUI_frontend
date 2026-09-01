// Import the litegraph barrel first to establish the correct module init
// order and avoid the LGraph <-> Subgraph circular dependency.
import '@/lib/litegraph/src/litegraph'

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { SubgraphIONodeBase } from '@/lib/litegraph/src/subgraph/SubgraphIONodeBase'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { useSubgraphDragBridge } from '@/renderer/core/canvas/links/useSubgraphDragBridge'

const { mockCreateAdapter, mockLayoutStore, mockRegistry, mockOrchestrator } =
  vi.hoisted(() => ({
    mockCreateAdapter: vi.fn(),
    mockLayoutStore: {
      getAllSlotKeys: vi.fn(() => [] as string[]),
      getSlotLayout: vi.fn()
    },
    mockRegistry: { getNode: vi.fn() },
    mockOrchestrator: {
      resolveSlotTargetCandidate: vi.fn(),
      resolveNodeSurfaceSlotCandidate: vi.fn()
    }
  }))

const setDirty = vi.fn()

vi.mock('@/scripts/app', () => ({
  app: {
    get canvas() {
      return { setDirty }
    }
  }
}))

vi.mock('@/renderer/core/canvas/links/linkConnectorAdapter', () => ({
  createLinkConnectorAdapter: () => mockCreateAdapter()
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: mockLayoutStore
}))

vi.mock('@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore', () => ({
  useNodeSlotRegistryStore: () => mockRegistry
}))

vi.mock('@/renderer/core/canvas/links/linkDropOrchestrator', () => ({
  resolveSlotTargetCandidate: (...args: unknown[]) =>
    mockOrchestrator.resolveSlotTargetCandidate(...args),
  resolveNodeSurfaceSlotCandidate: (...args: unknown[]) =>
    mockOrchestrator.resolveNodeSurfaceSlotCandidate(...args)
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction',
  () => ({
    resolvePointerTarget: (...args: unknown[]) =>
      mockResolvePointerTarget(...args)
  })
)

const mockResolvePointerTarget = vi.fn()

// Run RAF batches synchronously so pointermove handling is deterministic.
vi.mock('@/utils/rafBatch', () => ({
  createRafBatch: (run: () => void) => ({
    schedule: run,
    cancel: () => {},
    flush: run,
    isScheduled: () => false
  })
}))

function createSubgraphIONode(id: string) {
  const node = Object.create(
    SubgraphIONodeBase.prototype
  ) as SubgraphIONodeBase<never>
  Object.assign(node, { id })
  return node
}

function createMockCanvas() {
  const events = new EventTarget()
  return {
    linkConnector: {
      events,
      state: { snapLinksPos: undefined as [number, number] | undefined }
    },
    getCanvasWindow: () => ({ document })
  }
}

type MockCanvas = ReturnType<typeof createMockCanvas>

function dispatchConnecting(
  canvas: MockCanvas,
  connectingTo: 'input' | 'output'
) {
  canvas.linkConnector.events.dispatchEvent(
    new CustomEvent('connecting', { detail: { connectingTo } })
  )
}

describe('useSubgraphDragBridge', () => {
  let scope: ReturnType<typeof effectScope>
  let canvas: MockCanvas

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockLayoutStore.getAllSlotKeys.mockReturnValue([])
    useSlotLinkDragUIState().endDrag()
    canvas = createMockCanvas()
  })

  afterEach(() => {
    scope?.stop()
  })

  async function mountBridge() {
    scope = effectScope()
    scope.run(() => useSubgraphDragBridge())
    const canvasStore = useCanvasStore()
    canvasStore.canvas = canvas as never
    await nextTick()
  }

  it('does not begin a drag for non-subgraph source nodes', async () => {
    const plainNode = { id: 'plain' }
    mockCreateAdapter.mockReturnValue({
      renderLinks: [{ node: plainNode, fromSlotIndex: 0, fromPos: [0, 0] }],
      network: { getNodeById: vi.fn() },
      isInputValidDrop: vi.fn(),
      isOutputValidDrop: vi.fn()
    })

    await mountBridge()
    dispatchConnecting(canvas, 'input')

    expect(useSlotLinkDragUIState().state.active).toBe(false)
  })

  it('ignores connecting events when no adapter is available', async () => {
    mockCreateAdapter.mockReturnValue(null)

    await mountBridge()
    dispatchConnecting(canvas, 'input')

    expect(useSlotLinkDragUIState().state.active).toBe(false)
  })

  it('begins a drag and marks slot compatibility for subgraph IO drags', async () => {
    const node = createSubgraphIONode('sg1')
    mockLayoutStore.getAllSlotKeys.mockReturnValue(['n2-in-0', 'n3-out-0'])
    mockLayoutStore.getSlotLayout.mockImplementation((key: string) => {
      if (key === 'n2-in-0')
        return { nodeId: 'n2', index: 0, type: 'input' as const }
      if (key === 'n3-out-0')
        return { nodeId: 'n3', index: 0, type: 'output' as const }
      return undefined
    })
    const isInputValidDrop = vi.fn(() => true)
    mockCreateAdapter.mockReturnValue({
      renderLinks: [
        { node, fromSlotIndex: 2, fromDirection: 3, fromPos: [10, 20] }
      ],
      network: { getNodeById: vi.fn() },
      isInputValidDrop,
      isOutputValidDrop: vi.fn(() => false)
    })

    await mountBridge()
    dispatchConnecting(canvas, 'input')

    const { state } = useSlotLinkDragUIState()
    expect(state.active).toBe(true)
    expect(state.source).toMatchObject({
      nodeId: 'sg1',
      slotIndex: 2,
      type: 'output'
    })
    // Only the slot matching the connecting side ('input') is evaluated.
    expect(isInputValidDrop).toHaveBeenCalledWith('n2', 0)
    expect(state.compatible.get('n2-in-0')).toBe(true)
    expect(state.compatible.has('n3-out-0')).toBe(false)
  })

  it('resolves a candidate and highlights the snap target on pointer move', async () => {
    const node = createSubgraphIONode('sg1')
    mockCreateAdapter.mockReturnValue({
      renderLinks: [
        { node, fromSlotIndex: 0, fromDirection: 3, fromPos: [0, 0] }
      ],
      network: { getNodeById: vi.fn() },
      isInputValidDrop: vi.fn(() => true),
      isOutputValidDrop: vi.fn(() => false)
    })

    const slotEl = document.createElement('div')
    slotEl.className = 'lg-slot'
    const slotKeyEl = document.createElement('div')
    slotKeyEl.setAttribute('data-slot-key', 'n2-in-0')
    slotEl.appendChild(slotKeyEl)
    const nodeEl = document.createElement('div')
    nodeEl.setAttribute('data-node-id', 'n2')
    nodeEl.appendChild(slotEl)
    mockResolvePointerTarget.mockReturnValue(slotKeyEl)

    mockOrchestrator.resolveSlotTargetCandidate.mockReturnValue({
      layout: {
        nodeId: 'n2',
        index: 0,
        type: 'input',
        position: { x: 100, y: 200 }
      },
      compatible: true
    })
    mockOrchestrator.resolveNodeSurfaceSlotCandidate.mockReturnValue(null)

    const dotEl = document.createElement('div')
    const groupEl = document.createElement('div')
    groupEl.appendChild(dotEl)
    mockRegistry.getNode.mockReturnValue({
      slots: new Map([['n2-in-0', { el: dotEl }]])
    })

    await mountBridge()
    dispatchConnecting(canvas, 'input')

    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 50, clientY: 60 })
    )

    const { state } = useSlotLinkDragUIState()
    expect(state.candidate?.layout.nodeId).toBe('n2')
    expect(groupEl.classList.contains('lg-slot--snap-target')).toBe(true)
    expect(canvas.linkConnector.state.snapLinksPos).toEqual([100, 200])
    expect(setDirty).toHaveBeenCalled()
  })

  it('connects to the compatible candidate on before-drop-on-canvas', async () => {
    const node = createSubgraphIONode('sg1')
    const connectToInput = vi.fn()
    const targetNode = { inputs: [{}], outputs: [] }
    const renderLink = {
      node,
      fromSlotIndex: 0,
      fromDirection: 3,
      fromPos: [0, 0],
      toType: 'input',
      canConnectToInput: vi.fn(() => true),
      connectToInput
    }
    mockCreateAdapter.mockReturnValue({
      renderLinks: [renderLink],
      network: { getNodeById: vi.fn(() => targetNode) },
      isInputValidDrop: vi.fn(() => true),
      isOutputValidDrop: vi.fn(() => false)
    })
    mockResolvePointerTarget.mockReturnValue(null)
    mockOrchestrator.resolveSlotTargetCandidate.mockReturnValue(null)
    mockOrchestrator.resolveNodeSurfaceSlotCandidate.mockReturnValue(null)

    await mountBridge()
    dispatchConnecting(canvas, 'input')

    // Seed a compatible candidate directly into the shared drag state.
    useSlotLinkDragUIState().setCandidate({
      layout: {
        nodeId: 'n2',
        index: 0,
        type: 'input',
        position: { x: 0, y: 0 }
      },
      compatible: true
    } as never)

    const dropEvent = new CustomEvent('before-drop-on-canvas')
    const preventDefault = vi.spyOn(dropEvent, 'preventDefault')
    canvas.linkConnector.events.dispatchEvent(dropEvent)

    expect(connectToInput).toHaveBeenCalledWith(
      targetNode,
      targetNode.inputs[0],
      canvas.linkConnector.events
    )
    expect(preventDefault).toHaveBeenCalled()
  })

  it('does not intercept the drop when there is no compatible candidate', async () => {
    const node = createSubgraphIONode('sg1')
    mockCreateAdapter.mockReturnValue({
      renderLinks: [
        { node, fromSlotIndex: 0, fromDirection: 3, fromPos: [0, 0] }
      ],
      network: { getNodeById: vi.fn() },
      isInputValidDrop: vi.fn(() => true),
      isOutputValidDrop: vi.fn(() => false)
    })

    await mountBridge()
    dispatchConnecting(canvas, 'input')

    const dropEvent = new CustomEvent('before-drop-on-canvas')
    const preventDefault = vi.spyOn(dropEvent, 'preventDefault')
    canvas.linkConnector.events.dispatchEvent(dropEvent)

    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('ends the drag on reset', async () => {
    const node = createSubgraphIONode('sg1')
    mockCreateAdapter.mockReturnValue({
      renderLinks: [
        { node, fromSlotIndex: 0, fromDirection: 3, fromPos: [0, 0] }
      ],
      network: { getNodeById: vi.fn() },
      isInputValidDrop: vi.fn(() => true),
      isOutputValidDrop: vi.fn(() => false)
    })

    await mountBridge()
    dispatchConnecting(canvas, 'input')
    expect(useSlotLinkDragUIState().state.active).toBe(true)

    canvas.linkConnector.events.dispatchEvent(new CustomEvent('reset'))
    expect(useSlotLinkDragUIState().state.active).toBe(false)
  })

  it('ends an in-progress drag when the scope is disposed', async () => {
    const node = createSubgraphIONode('sg1')
    mockCreateAdapter.mockReturnValue({
      renderLinks: [
        { node, fromSlotIndex: 0, fromDirection: 3, fromPos: [0, 0] }
      ],
      network: { getNodeById: vi.fn() },
      isInputValidDrop: vi.fn(() => true),
      isOutputValidDrop: vi.fn(() => false)
    })

    await mountBridge()
    dispatchConnecting(canvas, 'input')
    expect(useSlotLinkDragUIState().state.active).toBe(true)

    scope.stop()
    expect(useSlotLinkDragUIState().state.active).toBe(false)
  })
})
