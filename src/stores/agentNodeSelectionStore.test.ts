import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const dialogStack = vi.hoisted(() => [] as unknown[])

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ dialogStack })
}))

/**
 * Real nodes carry `pos`/`size`; `boundingRect` is litegraph-renderer cache that
 * stays zeroed under Vue nodes, so the fit deliberately ignores it.
 */
function graphNode(
  id: number,
  pos?: [number, number],
  size?: [number, number]
) {
  return { id, pos, size, boundingRect: new Float64Array(4) }
}

/** The minimum canvas surface entering and leaving the mode touches. */
function stubCanvas(nodes: unknown[], selected: unknown[] = []) {
  const animateToBounds = vi.fn()
  const selectedItems = new Set(selected)
  const deselectAll = vi.fn(() => selectedItems.clear())
  useCanvasStore().canvas = {
    graph: { nodes },
    selectedItems,
    deselectAll,
    animateToBounds,
    canvas: { width: 1600, height: 900 }
  } as never
  return { animateToBounds, deselectAll, selectedItems }
}

describe('agentNodeSelectionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dialogStack.length = 0
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('frames the graph on entering, whatever opened the mode', () => {
    const { animateToBounds } = stubCanvas([
      graphNode(1, [0, 0], [100, 100]),
      graphNode(2, [500, 300], [100, 100])
    ])

    useAgentNodeSelectionStore().enter()

    expect(animateToBounds).toHaveBeenCalledOnce()
    const [bounds, options] = animateToBounds.mock.calls[0]
    // Encloses both nodes (0,0 to 600,400), plus 40 units of padding each side.
    expect(bounds).toEqual([-40, -40, 680, 480])
    expect(options.viewport).toEqual([0, 0, 1600, 900])
  })

  // Under Vue nodes `boundingRect` is all zeroes, so a fit driven off it would
  // frame a degenerate rect at the origin instead of the graph.
  it('frames from pos/size, not the zeroed litegraph boundingRect', () => {
    const { animateToBounds } = stubCanvas([
      graphNode(1, [1000, 800], [200, 100])
    ])

    useAgentNodeSelectionStore().enter()

    const [bounds] = animateToBounds.mock.calls[0]
    expect(bounds).toEqual([960, 760, 280, 180])
  })

  it('leaves the camera alone when nothing is positioned yet', () => {
    const { animateToBounds } = stubCanvas([graphNode(1), graphNode(2)])

    useAgentNodeSelectionStore().enter()

    expect(animateToBounds).not.toHaveBeenCalled()
  })

  it('leaves the camera alone on an empty graph', () => {
    const { animateToBounds } = stubCanvas([])

    useAgentNodeSelectionStore().enter()

    expect(animateToBounds).not.toHaveBeenCalled()
  })

  // Picking is finished, but the references stay in the composer - so the
  // canvas goes back to looking untouched while the basket keeps its chips.
  it('clears the canvas selection on exit', () => {
    const node = graphNode(1, [0, 0], [100, 100])
    const { deselectAll, selectedItems } = stubCanvas([node], [node])
    const store = useAgentNodeSelectionStore()

    store.enter()
    store.exit()

    expect(deselectAll).toHaveBeenCalledOnce()
    expect(selectedItems.size).toBe(0)
  })

  it('leaves the canvas alone on exit when nothing was selected', () => {
    const { deselectAll } = stubCanvas([graphNode(1, [0, 0], [100, 100])])
    const store = useAgentNodeSelectionStore()

    store.enter()
    store.exit()

    expect(deselectAll).not.toHaveBeenCalled()
  })

  // Entering with a selection means the user already knows which nodes they
  // care about; framing the whole graph would zoom away from them.
  it('frames the selection when entering with nodes already selected', () => {
    const selected = graphNode(2, [1000, 800], [200, 100])
    const { animateToBounds } = stubCanvas(
      [graphNode(1, [0, 0], [100, 100]), selected],
      [selected]
    )

    useAgentNodeSelectionStore().enter()

    const [bounds] = animateToBounds.mock.calls[0]
    expect(bounds).toEqual([960, 760, 280, 180])
  })

  it('does not frame the graph on exit', () => {
    const { animateToBounds } = stubCanvas([graphNode(1, [0, 0], [100, 100])])
    const store = useAgentNodeSelectionStore()

    store.enter()
    animateToBounds.mockClear()
    store.exit()

    expect(animateToBounds).not.toHaveBeenCalled()
  })

  it('sequences selection chrome and restores the open sidebar', async () => {
    const sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = 'assets'
    const store = useAgentNodeSelectionStore()

    store.enter()
    await nextTick()

    expect(store.isActive).toBe(true)
    expect(store.isActionBarsHidden).toBe(true)
    expect(store.isBannerVisible).toBe(false)
    expect(sidebar.activeSidebarTabId).toBe('assets')

    vi.advanceTimersByTime(200)
    expect(sidebar.activeSidebarTabId).toBeNull()

    vi.advanceTimersByTime(100)
    expect(store.isBannerVisible).toBe(true)

    store.exit()
    await nextTick()

    expect(store.isActive).toBe(false)
    expect(store.isBannerVisible).toBe(false)
    expect(store.isActionBarsHidden).toBe(true)
    // Staged like the entry side: still closed while the banner retracts.
    expect(sidebar.activeSidebarTabId).toBeNull()

    vi.advanceTimersByTime(150)
    expect(store.isActionBarsHidden).toBe(false)
    expect(sidebar.activeSidebarTabId).toBe('assets')
  })

  it('does not reopen a sidebar the user never had open', () => {
    const sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = null
    const store = useAgentNodeSelectionStore()

    store.enter()
    vi.advanceTimersByTime(200)
    store.exit()
    vi.advanceTimersByTime(150)

    expect(sidebar.activeSidebarTabId).toBeNull()
  })

  it('exits on Escape unless a dialog is open', async () => {
    const store = useAgentNodeSelectionStore()
    store.enter()
    await nextTick()

    dialogStack.push({})
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(store.isActive).toBe(true)

    dialogStack.length = 0
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(store.isActive).toBe(false)
  })

  it('keeps node selections scoped to their workflow while loading', () => {
    const store = useAgentNodeSelectionStore()

    store.saveNodeIds('workflows/first.json', ['9', '12'])
    store.beginWorkflowLoad()
    store.saveNodeIds('workflows/second.json', ['20'])

    expect(store.isLoadingWorkflow).toBe(true)
    expect(store.nodeIds('workflows/first.json')).toEqual(['9', '12'])
    expect(store.nodeIds('workflows/second.json')).toEqual(['20'])

    store.restoreNodeIds(['20'])
    expect(store.restoredNodeIds).toEqual(['20'])

    store.finishWorkflowLoad()

    expect(store.isLoadingWorkflow).toBe(false)
    expect(store.restoredNodeIds).toBeNull()
  })
})
