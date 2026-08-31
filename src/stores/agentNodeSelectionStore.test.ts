import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const dialogStack = vi.hoisted(() => [] as unknown[])
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

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ dialogStack })
}))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settings
}))

function stubCanvas(selected = false) {
  const node = { id: 1 }
  const selectedItems = new Set(selected ? [node] : [])
  const canvasElement = document.createElement('canvas')
  const focus = vi.spyOn(canvasElement, 'focus')
  const canvas = {
    allow_dragnodes: true,
    multi_select: false,
    selectOnly: false,
    selectedItems,
    canvas: canvasElement,
    deselectAll: vi.fn(() => selectedItems.clear()),
    fitViewToSelectionAnimated: vi.fn(),
    focus
  }
  useCanvasStore().canvas = canvas as never
  return canvas
}

describe('agentNodeSelectionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dialogStack.length = 0
    settings.values.clear()
    settings.set.mockClear()
    document.body.classList.remove('node-selection-active')
    setActivePinia(createPinia())
  })

  it('locks graph editing, fits the selection, and restores canvas state', async () => {
    const canvas = stubCanvas(true)
    const store = useAgentNodeSelectionStore()

    store.enter()
    await nextTick()

    expect(canvas.selectOnly).toBe(true)
    expect(canvas.allow_dragnodes).toBe(false)
    expect(canvas.multi_select).toBe(true)
    expect(canvas.fitViewToSelectionAnimated).toHaveBeenCalledWith({
      duration: 300
    })
    expect(canvas.canvas.focus).toHaveBeenCalledOnce()
    expect(document.body).toHaveClass('node-selection-active')

    store.exit()
    await nextTick()

    expect(canvas.selectOnly).toBe(false)
    expect(canvas.allow_dragnodes).toBe(true)
    expect(canvas.multi_select).toBe(false)
    expect(canvas.deselectAll).toHaveBeenCalledOnce()
    expect(document.body).not.toHaveClass('node-selection-active')
  })

  it('hides surrounding UI and restores the sidebar and minimap', async () => {
    settings.values.set('Comfy.Minimap.Visible', true)
    useSidebarTabStore().activeSidebarTabId = 'assets'
    const store = useAgentNodeSelectionStore()

    store.enter()
    await nextTick()
    expect(store.isActionBarsHidden).toBe(true)
    expect(store.isBannerVisible).toBe(false)
    expect(settings.values.get('Comfy.Minimap.Visible')).toBe(false)

    vi.advanceTimersByTime(300)
    expect(store.isBannerVisible).toBe(true)
    expect(useSidebarTabStore().activeSidebarTabId).toBeNull()

    store.exit()
    await nextTick()
    vi.advanceTimersByTime(150)

    expect(store.isActionBarsHidden).toBe(false)
    expect(useSidebarTabStore().activeSidebarTabId).toBe('assets')
    expect(settings.values.get('Comfy.Minimap.Visible')).toBe(true)
  })

  it('exits on Escape unless a dialog is open', async () => {
    stubCanvas()
    const store = useAgentNodeSelectionStore()
    store.enter()

    dialogStack.push({})
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(store.isActive).toBe(true)

    dialogStack.length = 0
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(store.isActive).toBe(false)
  })
})
