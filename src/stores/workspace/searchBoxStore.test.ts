import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type NodeSearchBoxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'
import { createMockMinimapCanvas } from '@/utils/__tests__/litegraphTestUtils'

function createMockPopover(): Pick<
  InstanceType<typeof NodeSearchBoxPopover>,
  'showSearchBox'
> {
  return { showSearchBox: vi.fn() }
}

describe('useSearchBoxStore', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      createMockMinimapCanvas().getContext
    )
    const canvas = new LGraphCanvas(
      document.createElement('canvas'),
      new LGraph(),
      { skip_render: true }
    )
    canvas.ds.scale = 2
    canvas.ds.offset = [0, 25]
    useCanvasStore().canvas = canvas
  })

  describe('when user has new search box enabled', () => {
    beforeEach(() => {
      useSettingStore().settingValues['Comfy.NodeSearchBoxImpl'] = 'default'
    })

    it('should show new search box is enabled', () => {
      const store = useSearchBoxStore()
      expect(store.newSearchBoxEnabled).toBe(true)
    })

    it('should toggle search box visibility when user presses shortcut', () => {
      const store = useSearchBoxStore()

      expect(store.visible).toBe(false)

      store.toggleVisible()
      expect(store.visible).toBe(true)

      store.toggleVisible()
      expect(store.visible).toBe(false)
    })
  })

  describe('when user has legacy search box enabled', () => {
    beforeEach(() => {
      useSettingStore().settingValues['Comfy.NodeSearchBoxImpl'] =
        'litegraph (legacy)'
    })

    it('should show new search box is disabled', () => {
      const store = useSearchBoxStore()
      expect(store.newSearchBoxEnabled).toBe(false)
    })

    it('should open legacy search box at mouse position when user presses shortcut', async () => {
      const store = useSearchBoxStore()
      const mockPopover = createMockPopover()
      store.setPopoverRef(mockPopover)
      const adjustMouseEvent = vi.spyOn(
        useCanvasStore().getCanvas(),
        'adjustMouseEvent'
      )
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 100, clientY: 200 })
      )
      await nextTick()

      expect(vi.mocked(store.visible)).toBe(false)

      store.toggleVisible()

      expect(vi.mocked(store.visible)).toBe(false) // Doesn't become visible in legacy mode.

      expect(vi.mocked(mockPopover.showSearchBox)).toHaveBeenCalledWith(
        expect.objectContaining({
          clientX: 100,
          clientY: 200,
          canvasX: 50,
          canvasY: 75
        })
      )
      expect(adjustMouseEvent).toHaveBeenCalledOnce()
    })

    it('should do nothing when user presses shortcut but popover is not ready', () => {
      const store = useSearchBoxStore()
      store.setPopoverRef(null)

      store.toggleVisible()

      expect(store.visible).toBe(false)
    })
  })

  describe('when user configures popover reference', () => {
    beforeEach(() => {
      useSettingStore().settingValues['Comfy.NodeSearchBoxImpl'] =
        'litegraph (legacy)'
    })

    it('should enable legacy search when popover is set', () => {
      const store = useSearchBoxStore()
      const mockPopover = createMockPopover()
      store.setPopoverRef(mockPopover)

      store.toggleVisible()

      expect(vi.mocked(mockPopover.showSearchBox)).toHaveBeenCalled()
    })

    it('should disable legacy search when popover is cleared', () => {
      const store = useSearchBoxStore()
      const mockPopover = createMockPopover()
      store.setPopoverRef(mockPopover)
      store.setPopoverRef(null)

      store.toggleVisible()

      expect(vi.mocked(mockPopover.showSearchBox)).not.toHaveBeenCalled()
    })
  })

  describe('when user first loads the application', () => {
    it('should have search box hidden by default', () => {
      const store = useSearchBoxStore()
      expect(store.visible).toBe(false)
    })
  })
})
