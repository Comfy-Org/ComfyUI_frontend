import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConflictAcknowledgment } from '@/composables/useConflictAcknowledgment'

describe('useConflictAcknowledgment', () => {
  beforeEach(() => {
    // Set up Pinia for each test
    setActivePinia(createPinia())
    // Clear localStorage before each test
    localStorage.clear()
    // Reset modules to ensure fresh state
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initial state loading', () => {
    it('should load empty state when localStorage is empty', () => {
      const { acknowledgmentState } = useConflictAcknowledgment()

      expect(acknowledgmentState.value).toEqual({
        modal_dismissed: false,
        red_dot_dismissed: false,
        warning_banner_dismissed: false
      })
    })

    it('should load existing state from localStorage', () => {
      // Pre-populate localStorage
      localStorage.setItem('Comfy.ConflictModalDismissed', 'true')
      localStorage.setItem('Comfy.ConflictRedDotDismissed', 'true')
      localStorage.setItem('Comfy.ConflictWarningBannerDismissed', 'true')

      const { acknowledgmentState } = useConflictAcknowledgment()

      expect(acknowledgmentState.value).toEqual({
        modal_dismissed: true,
        red_dot_dismissed: true,
        warning_banner_dismissed: true
      })
    })
  })

  describe('dismissal functions', () => {
    it('should mark conflicts as seen with unified function', () => {
      const { markConflictsAsSeen, acknowledgmentState } =
        useConflictAcknowledgment()

      markConflictsAsSeen()

      expect(acknowledgmentState.value.modal_dismissed).toBe(true)
    })

    it('should dismiss red dot notification', () => {
      const { dismissRedDotNotification, acknowledgmentState } =
        useConflictAcknowledgment()

      dismissRedDotNotification()

      expect(acknowledgmentState.value.red_dot_dismissed).toBe(true)
    })

    it('should dismiss warning banner', () => {
      const { dismissWarningBanner, acknowledgmentState } =
        useConflictAcknowledgment()

      dismissWarningBanner()

      expect(acknowledgmentState.value.warning_banner_dismissed).toBe(true)
    })

    it('should mark all conflicts as seen', () => {
      const { markConflictsAsSeen, acknowledgmentState } =
        useConflictAcknowledgment()

      markConflictsAsSeen()

      expect(acknowledgmentState.value.modal_dismissed).toBe(true)
      expect(acknowledgmentState.value.red_dot_dismissed).toBe(true)
      expect(acknowledgmentState.value.warning_banner_dismissed).toBe(true)
    })
  })

  describe('computed properties', () => {
    it('should calculate shouldShowConflictModal correctly', () => {
      const { shouldShowConflictModal, markConflictsAsSeen } =
        useConflictAcknowledgment()

      expect(shouldShowConflictModal.value).toBe(true)

      markConflictsAsSeen()
      expect(shouldShowConflictModal.value).toBe(false)
    })

    it('should calculate shouldShowRedDot correctly based on conflicts', () => {
      const { shouldShowRedDot, dismissRedDotNotification } =
        useConflictAcknowledgment()

      // Initially false because no conflicts exist
      expect(shouldShowRedDot.value).toBe(false)

      dismissRedDotNotification()
      expect(shouldShowRedDot.value).toBe(false)
    })

    it('should calculate shouldShowManagerBanner correctly', () => {
      const { shouldShowManagerBanner, dismissWarningBanner } =
        useConflictAcknowledgment()

      // Initially false because no conflicts exist
      expect(shouldShowManagerBanner.value).toBe(false)

      dismissWarningBanner()
      expect(shouldShowManagerBanner.value).toBe(false)
    })
  })

  describe('localStorage persistence', () => {
    it('should persist to localStorage automatically', () => {
      const { markConflictsAsSeen, dismissWarningBanner } =
        useConflictAcknowledgment()

      markConflictsAsSeen()
      dismissWarningBanner()

      // VueUse useStorage should automatically persist to localStorage
      expect(
        localStorage.getItem('Comfy.ConflictModalDismissed')
      ).not.toBeNull()
      expect(
        localStorage.getItem('Comfy.ConflictWarningBannerDismissed')
      ).not.toBeNull()
    })
  })
})
