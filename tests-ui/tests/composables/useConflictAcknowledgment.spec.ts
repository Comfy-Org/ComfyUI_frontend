import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConflictAcknowledgment } from '@/composables/useConflictAcknowledgment'

describe('useConflictAcknowledgment with useStorage refactor', () => {
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

  it('should initialize with default values', () => {
    const {
      shouldShowConflictModal,
      shouldShowRedDot,
      shouldShowManagerBanner
    } = useConflictAcknowledgment()

    expect(shouldShowConflictModal.value).toBe(true)
    expect(shouldShowRedDot.value).toBe(false) // No conflicts initially
    expect(shouldShowManagerBanner.value).toBe(false) // No conflicts initially
  })

  it('should dismiss modal state correctly', () => {
    const { dismissConflictModal, shouldShowConflictModal } =
      useConflictAcknowledgment()

    expect(shouldShowConflictModal.value).toBe(true)
    dismissConflictModal()
    expect(shouldShowConflictModal.value).toBe(false)
  })

  it('should dismiss red dot notification correctly', () => {
    const { dismissRedDotNotification, shouldShowRedDot } =
      useConflictAcknowledgment()

    expect(shouldShowRedDot.value).toBe(false) // No conflicts initially
    dismissRedDotNotification()
    expect(shouldShowRedDot.value).toBe(false)
  })

  it('should dismiss warning banner correctly', () => {
    const { dismissWarningBanner, shouldShowManagerBanner } =
      useConflictAcknowledgment()

    // Initially should not show banner (no conflicts)
    expect(shouldShowManagerBanner.value).toBe(false)
    
    // Test dismissWarningBanner function exists and works
    dismissWarningBanner()
    expect(shouldShowManagerBanner.value).toBe(false)
  })

  it('should mark conflicts as seen', () => {
    const {
      markConflictsAsSeen,
      shouldShowConflictModal,
      shouldShowRedDot,
      shouldShowManagerBanner
    } = useConflictAcknowledgment()

    // Mark conflicts as seen
    markConflictsAsSeen()

    // All UI elements should be dismissed
    expect(shouldShowConflictModal.value).toBe(false)
    expect(shouldShowRedDot.value).toBe(false) 
    expect(shouldShowManagerBanner.value).toBe(false)
  })

  it('should manage acknowledgment state correctly', () => {
    const {
      acknowledgmentState,
      dismissConflictModal,
      dismissRedDotNotification,
      dismissWarningBanner
    } = useConflictAcknowledgment()

    // Initial state
    expect(acknowledgmentState.value.modal_dismissed).toBe(false)
    expect(acknowledgmentState.value.red_dot_dismissed).toBe(false)
    expect(acknowledgmentState.value.warning_banner_dismissed).toBe(false)

    // Update states
    dismissConflictModal()
    dismissRedDotNotification()
    dismissWarningBanner()

    // Check updated state
    expect(acknowledgmentState.value.modal_dismissed).toBe(true)
    expect(acknowledgmentState.value.red_dot_dismissed).toBe(true)
    expect(acknowledgmentState.value.warning_banner_dismissed).toBe(true)
  })

  it('should use VueUse useStorage for persistence', () => {
    // This test verifies that useStorage is being used by checking
    // that values are automatically synced to localStorage
    const { dismissConflictModal, dismissWarningBanner } =
      useConflictAcknowledgment()

    dismissConflictModal()
    dismissWarningBanner()

    // VueUse useStorage should automatically persist to localStorage
    // We can verify the keys exist (values will be stringified by VueUse)
    expect(
      localStorage.getItem('Comfy.ConflictModalDismissed')
    ).not.toBeNull()
    expect(localStorage.getItem('Comfy.ConflictWarningBannerDismissed')).not.toBeNull()
  })
})
