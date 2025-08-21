import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/stores/settingStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'

// Mock dependencies
vi.mock('@vueuse/core', () => ({
  useMouse: vi.fn(() => ({
    x: { value: 100 },
    y: { value: 200 }
  }))
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn()
}))

describe('useSearchBoxStore', () => {
  let store: ReturnType<typeof useSearchBoxStore>
  let mockSettingStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockSettingStore = {
      get: vi.fn()
    }
    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore)

    store = useSearchBoxStore()
    vi.clearAllMocks()
  })

  describe('when user has new search box enabled', () => {
    beforeEach(() => {
      vi.mocked(mockSettingStore.get).mockReturnValue('default')
    })

    it('should show new search box is enabled', () => {
      expect(store.newSearchBoxEnabled).toBe(true)
    })

    it('should toggle search box visibility when user presses shortcut', () => {
      expect(store.visible).toBe(false)

      store.toggleVisible()
      expect(store.visible).toBe(true)

      store.toggleVisible()
      expect(store.visible).toBe(false)
    })
  })

  describe('when user has legacy search box enabled', () => {
    beforeEach(() => {
      vi.mocked(mockSettingStore.get).mockReturnValue('legacy')
    })

    it('should show new search box is disabled', () => {
      expect(store.newSearchBoxEnabled).toBe(false)
    })

    it('should open legacy search box at mouse position when user presses shortcut', () => {
      const mockPopover = { showSearchBox: vi.fn() }
      store.setPopoverRef(mockPopover as any)

      store.toggleVisible()

      expect(vi.mocked(mockPopover.showSearchBox)).toHaveBeenCalledWith(
        expect.objectContaining({
          clientX: 100,
          clientY: 200
        })
      )
    })

    it('should do nothing when user presses shortcut but popover is not ready', () => {
      store.setPopoverRef(null)

      store.toggleVisible()

      expect(store.visible).toBe(false)
    })
  })

  describe('when user configures popover reference', () => {
    beforeEach(() => {
      vi.mocked(mockSettingStore.get).mockReturnValue('legacy')
    })

    it('should enable legacy search when popover is set', () => {
      const mockPopover = { showSearchBox: vi.fn() }
      store.setPopoverRef(mockPopover as any)

      store.toggleVisible()

      expect(vi.mocked(mockPopover.showSearchBox)).toHaveBeenCalled()
    })

    it('should disable legacy search when popover is cleared', () => {
      const mockPopover = { showSearchBox: vi.fn() }
      store.setPopoverRef(mockPopover as any)
      store.setPopoverRef(null)

      store.toggleVisible()

      expect(vi.mocked(mockPopover.showSearchBox)).not.toHaveBeenCalled()
    })
  })

  describe('when user first loads the application', () => {
    it('should have search box hidden by default', () => {
      expect(store.visible).toBe(false)
    })
  })
})
