/**
 * Lifecycle tests for the minimap's change-detection interval, run against the
 * real `useIntervalFn` with fake timers. The main useMinimap test file mocks
 * the vueuse timing primitives wholesale, which cannot catch a polling loop
 * that fails to stop on hide/destroy or resumes eagerly on show.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'

import {
  createMockCanvas2DContext,
  createMockLinks,
  createMockMinimapCanvas
} from '@/utils/__tests__/litegraphTestUtils'

const mockNodes = [
  {
    id: 'node1',
    pos: [0, 0],
    size: [100, 50],
    renderingSize: [100, 50],
    outputs: []
  },
  {
    id: 'node2',
    pos: [200, 100],
    size: [150, 75],
    renderingSize: [150, 75],
    outputs: []
  }
]

const mockGraph = {
  id: 'root',
  rootGraph: { id: 'root' },
  _groups: [],
  _nodes: mockNodes,
  links: createMockLinks([]),
  getNodeById: vi.fn((id: string) => mockNodes.find((n) => n.id === id)),
  setDirtyCanvas: vi.fn(),
  onNodeAdded: null,
  onNodeRemoved: null,
  onConnectionChange: null,
  events: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}

const mockCanvas = {
  graph: mockGraph,
  canvas: { width: 1000, height: 800, clientWidth: 1000, clientHeight: 800 },
  ds: { scale: 1, offset: [0, 0] },
  setDirty: vi.fn()
}

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn(() => ({ canvas: mockCanvas }))
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn().mockReturnValue(true),
    set: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn(() => ({
    completedActivePalette: { light_theme: false }
  }))
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    apiURL: vi.fn().mockReturnValue('http://localhost:8188')
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: mockGraph } }
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({ activeSubgraph: null }))
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => ({
    nodeLocationProgressStates: {},
    nodeProgressStates: {}
  }))
}))

import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'

const POLL_MS = 100

describe('useMinimap change-detection interval', () => {
  let context: CanvasRenderingContext2D
  let active: { destroy: () => void } | null = null

  async function initMinimap() {
    const canvasElement = createMockMinimapCanvas({
      getContext: vi
        .fn()
        .mockImplementation((id) =>
          id === '2d' ? context : null
        ) as HTMLCanvasElement['getContext']
    })
    const container = {
      getBoundingClientRect: vi.fn(() => new DOMRect(0, 0, 250, 200) as DOMRect)
    }

    const minimap = useMinimap({
      containerRefMaybe: shallowRef(
        container as Partial<HTMLDivElement> as HTMLDivElement
      ),
      canvasRefMaybe: shallowRef(canvasElement)
    })
    await minimap.init()
    await nextTick()
    await vi.runOnlyPendingTimersAsync()
    active = minimap
    return minimap
  }

  function drawCalls(): number {
    return (
      vi.mocked(context.clearRect).mock.calls.length +
      vi.mocked(context.fillRect).mock.calls.length
    )
  }

  const moveNode = () => {
    mockNodes[0].pos = [mockNodes[0].pos[0] + 50, mockNodes[0].pos[1]]
  }

  beforeEach(() => {
    vi.useFakeTimers()
    context = createMockCanvas2DContext()
    mockNodes[0].pos = [0, 0]
  })

  afterEach(() => {
    // The graph is module scope and each init() layers another set of wrappers
    // onto its callbacks, so tear down before the next test builds its own.
    active?.destroy()
    active = null
  })

  it('polls on the interval and redraws when the graph changed', async () => {
    await initMinimap()
    const before = drawCalls()

    moveNode()
    await vi.advanceTimersByTimeAsync(POLL_MS + 10)

    expect(drawCalls()).toBeGreaterThan(before)
  })

  it('does not redraw while the graph is unchanged', async () => {
    await initMinimap()
    await vi.advanceTimersByTimeAsync(POLL_MS + 10)
    const settled = drawCalls()

    await vi.advanceTimersByTimeAsync(POLL_MS * 5)

    expect(drawCalls()).toBe(settled)
  })

  it('stops polling when hidden and resumes only after the next interval', async () => {
    const minimap = await initMinimap()

    // Hide: subsequent graph changes must not be picked up.
    await minimap.toggle()
    await nextTick()
    const hidden = drawCalls()

    moveNode()
    await vi.advanceTimersByTimeAsync(POLL_MS * 5)
    expect(drawCalls()).toBe(hidden)

    // Show again: the visibility watcher repaints the stale state immediately.
    await minimap.toggle()
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)
    const afterShow = drawCalls()
    expect(afterShow).toBeGreaterThan(hidden)

    // A change made after showing is only observed by polling: nothing before
    // the interval elapses, a redraw after it does.
    moveNode()
    await vi.advanceTimersByTimeAsync(POLL_MS - 20)
    expect(drawCalls()).toBe(afterShow)

    await vi.advanceTimersByTimeAsync(40)
    expect(drawCalls()).toBeGreaterThan(afterShow)
  })

  it('never starts polling in a document that was already hidden', async () => {
    // A background tab (middle-click, session restore) is hidden before mount,
    // so no visibilitychange ever fires and a transition-only guard would leave
    // the loop running for as long as the tab stays parked.
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')

    try {
      await initMinimap()
      const atInit = drawCalls()

      moveNode()
      await vi.advanceTimersByTimeAsync(POLL_MS * 5)

      expect(drawCalls()).toBe(atInit)
    } finally {
      visibility.mockRestore()
    }
  })

  it('a graphChanged event with nothing drawn changed does not repaint', async () => {
    // graphChanged fires for zIndex (every widget pointerdown), widget values
    // and title edits. The event is a hint to compare digests, not a command
    // to repaint.
    const { api } = await import('@/scripts/api')
    await initMinimap()
    await vi.advanceTimersByTimeAsync(POLL_MS + 10)
    const settled = drawCalls()

    const graphChangedHandler = vi
      .mocked(api.addEventListener)
      .mock.calls.find(([name]) => name === 'graphChanged')?.[1] as () => void
    expect(graphChangedHandler).toBeTypeOf('function')

    graphChangedHandler()
    await vi.advanceTimersByTimeAsync(POLL_MS * 6)
    expect(drawCalls()).toBe(settled)

    // The same path must still repaint when the picture did change.
    moveNode()
    graphChangedHandler()
    await vi.advanceTimersByTimeAsync(POLL_MS + 10)
    expect(drawCalls()).toBeGreaterThan(settled)
  })

  it('starts polling when the canvas mounts after init', async () => {
    // In the real component init() runs synchronously from the immediate
    // canvas watcher, before the template ref has mounted, so a start decision
    // taken inside init() sees a null canvasRef and never starts the loop.
    const canvasRef = shallowRef<HTMLCanvasElement | null>(null)
    const container = {
      getBoundingClientRect: vi.fn(() => new DOMRect(0, 0, 250, 200) as DOMRect)
    }
    const minimap = useMinimap({
      containerRefMaybe: shallowRef(
        container as Partial<HTMLDivElement> as HTMLDivElement
      ),
      canvasRefMaybe: canvasRef
    })
    active = minimap
    await minimap.init()
    await nextTick()

    // Template ref mounts after init.
    canvasRef.value = createMockMinimapCanvas({
      getContext: vi
        .fn()
        .mockImplementation((id) =>
          id === '2d' ? context : null
        ) as HTMLCanvasElement['getContext']
    })
    await nextTick()
    await vi.runOnlyPendingTimersAsync()

    moveNode()
    await vi.advanceTimersByTimeAsync(POLL_MS + 10)

    expect(drawCalls()).toBeGreaterThan(0)
  })

  it('stops polling after destroy', async () => {
    const minimap = await initMinimap()
    minimap.destroy()
    const atDestroy = drawCalls()

    moveNode()
    await vi.advanceTimersByTimeAsync(POLL_MS * 5)

    expect(drawCalls()).toBe(atDestroy)
  })
})
