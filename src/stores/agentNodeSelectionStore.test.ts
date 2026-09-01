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

const settings = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  return {
    values,
    get: (key: string) => values.get(key),
    set: vi.fn((key: string, value: unknown) => {
      values.set(key, value)
      return Promise.resolve()
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settings
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
  // A real element, not a `{ width, height }` literal: canvasStore attaches its
  // litegraph event listeners to `canvas.canvas` on assignment, and a plain
  // object rejects that registration on a post-flush tick nothing can await.
  const element = document.createElement('canvas')
  element.width = 1600
  element.height = 900
  useCanvasStore().canvas = {
    graph: { nodes },
    selectedItems,
    deselectAll,
    animateToBounds,
    canvas: element
  } as never
  return { animateToBounds, deselectAll, selectedItems }
}

describe('agentNodeSelectionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dialogStack.length = 0
    settings.values.clear()
    settings.set.mockClear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    document.body.classList.remove('node-selection-active')
  })

  // PrimeVue teleports every `<Toast>` container to `<body>` and several
  // components mount their own groups, so the layer can only be hidden from the
  // root. The mode owns the marker because no one toast component renders them
  // all - and because it must outlive any component that might unmount mid-mode.
  it('hides the toast layer for the duration of the mode', async () => {
    const store = useAgentNodeSelectionStore()

    store.enter()
    await nextTick()
    expect(document.body).toHaveClass('node-selection-active')

    store.exit()
    await nextTick()
    expect(document.body).not.toHaveClass('node-selection-active')
  })

  // Flipping the setting rather than overriding the minimap is what keeps the
  // user's own toggle working while they pick.
  it('turns a visible minimap off on entry and back on when leaving', async () => {
    settings.values.set('Comfy.Minimap.Visible', true)
    const store = useAgentNodeSelectionStore()

    store.enter()
    await nextTick()
    expect(settings.values.get('Comfy.Minimap.Visible')).toBe(false)

    store.exit()
    await nextTick()
    expect(settings.values.get('Comfy.Minimap.Visible')).toBe(true)
  })

  it('leaves the minimap setting alone when it was already off', async () => {
    settings.values.set('Comfy.Minimap.Visible', false)
    const store = useAgentNodeSelectionStore()

    store.enter()
    await nextTick()
    store.exit()
    await nextTick()

    expect(settings.set).not.toHaveBeenCalled()
    expect(settings.values.get('Comfy.Minimap.Visible')).toBe(false)
  })

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
  it('frames only the selected nodes when entering with a selection', () => {
    const picked = [
      graphNode(1, [100, 200], [50, 60]),
      graphNode(2, [300, 400], [80, 20])
    ]
    const outlier = graphNode(3, [5000, 5000], [100, 100])
    const { animateToBounds } = stubCanvas([...picked, outlier], picked)
    const store = useAgentNodeSelectionStore()

    store.enter()

    expect(animateToBounds).toHaveBeenCalledOnce()
    expect(animateToBounds).toHaveBeenCalledWith([60, 160, 360, 300], {
      viewport: [0, 0, 1600, 900]
    })
  })

  // With the minimap off there is no overview to pan with, so every entry
  // without a selection frames the whole graph to make each node pickable.
  it('frames the whole graph when entering with nothing selected', () => {
    const { animateToBounds } = stubCanvas([
      graphNode(1, [0, 0], [100, 100]),
      graphNode(2, [500, 300], [120, 80])
    ])
    const store = useAgentNodeSelectionStore()

    store.enter()

    expect(animateToBounds).toHaveBeenCalledOnce()
    expect(animateToBounds.mock.calls[0][0]).toEqual([-40, -40, 700, 460])
  })

  it('does not animate when the graph has no nodes', () => {
    const { animateToBounds } = stubCanvas([])
    const store = useAgentNodeSelectionStore()

    store.enter()

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
