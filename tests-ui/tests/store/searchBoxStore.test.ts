import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type NodeSearchBoxPopover from '@/components/searchbox/NodeSearchBoxPopover.vue'
import type { useSettingStore } from '@/platform/settings/settingStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'

// Mock dependencies
vi.mock('@vueuse/core', () => ({
  useMouse: vi.fn(() => ({
    x: { value: 100 },
    y: { value: 200 }
  }))
}))

const mockSettingStore = createMockSettingStore()
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => mockSettingStore)
}))

function createMockPopover(): InstanceType<typeof NodeSearchBoxPopover> {
  return { showSearchBox: vi.fn() } satisfies Partial<
    InstanceType<typeof NodeSearchBoxPopover>
  > as unknown as InstanceType<typeof NodeSearchBoxPopover>
}

function createMockSettingStore(): ReturnType<typeof useSettingStore> {
  return {
    get: vi.fn()
  } satisfies Partial<
    ReturnType<typeof useSettingStore>
  > as unknown as ReturnType<typeof useSettingStore>
}

describe('useSearchBoxStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    vi.restoreAllMocks()
  })

  describe('when user has new search box enabled', () => {
    beforeEach(() => {
      vi.mocked(mockSettingStore.get).mockReturnValue('default')
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
      vi.mocked(mockSettingStore.get).mockReturnValue('legacy')
    })

    it('should show new search box is disabled', () => {
      const store = useSearchBoxStore()
      expect(store.newSearchBoxEnabled).toBe(false)
    })

    it('should open legacy search box at mouse position when user presses shortcut', () => {
      const store = useSearchBoxStore()
      const mockPopover = createMockPopover()
      store.setPopoverRef(mockPopover)

      expect(vi.mocked(store.visible)).toBe(false)

      store.toggleVisible()

      expect(vi.mocked(store.visible)).toBe(false) // Doesn't become visible in legacy mode.

      expect(vi.mocked(mockPopover.showSearchBox)).toHaveBeenCalledWith(
        expect.objectContaining({
          clientX: 100,
          clientY: 200
        })
      )
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
      vi.mocked(mockSettingStore.get).mockReturnValue('legacy')
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
