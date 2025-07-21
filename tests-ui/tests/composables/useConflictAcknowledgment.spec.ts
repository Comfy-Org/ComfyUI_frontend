import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConflictAcknowledgment } from '@/composables/useConflictAcknowledgment'

describe('useConflictAcknowledgment with useStorage refactor', () => {
  beforeEach(() => {
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
      acknowledgedPackageIds
    } = useConflictAcknowledgment()

    expect(shouldShowConflictModal.value).toBe(true)
    expect(shouldShowRedDot.value).toBe(true)
    expect(acknowledgedPackageIds.value).toEqual([])
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

    expect(shouldShowRedDot.value).toBe(true)
    dismissRedDotNotification()
    expect(shouldShowRedDot.value).toBe(false)
  })

  it('should acknowledge conflicts correctly', () => {
    const {
      acknowledgeConflict,
      isConflictAcknowledged,
      acknowledgedPackageIds
    } = useConflictAcknowledgment()

    expect(acknowledgedPackageIds.value).toEqual([])

    acknowledgeConflict('package1', 'version_conflict', '1.0.0')

    expect(isConflictAcknowledged('package1', 'version_conflict')).toBe(true)
    expect(isConflictAcknowledged('package1', 'other_conflict')).toBe(false)
    expect(acknowledgedPackageIds.value).toContain('package1')
  })

  it('should reset state when ComfyUI version changes', () => {
    const {
      dismissConflictModal,
      acknowledgeConflict,
      checkComfyUIVersionChange,
      shouldShowConflictModal,
      acknowledgedPackageIds
    } = useConflictAcknowledgment()

    // Set up some state
    dismissConflictModal()
    acknowledgeConflict('package1', 'conflict1', '1.0.0')

    expect(shouldShowConflictModal.value).toBe(false)
    expect(acknowledgedPackageIds.value).toContain('package1')

    // First check sets the initial version, no change yet
    const changed1 = checkComfyUIVersionChange('1.0.0')
    expect(changed1).toBe(false)

    // Now check with different version should reset
    const changed2 = checkComfyUIVersionChange('2.0.0')
    expect(changed2).toBe(true)
    expect(shouldShowConflictModal.value).toBe(true)
    expect(acknowledgedPackageIds.value).toEqual([])
  })

  it('should track acknowledgment statistics correctly', () => {
    const { acknowledgmentStats, dismissConflictModal, acknowledgeConflict } =
      useConflictAcknowledgment()

    // Initial stats
    expect(acknowledgmentStats.value).toEqual({
      total_acknowledged: 0,
      unique_packages: 0,
      modal_dismissed: false,
      red_dot_dismissed: false,
      last_comfyui_version: ''
    })

    // Update state
    dismissConflictModal()
    acknowledgeConflict('package1', 'conflict1', '1.0.0')
    acknowledgeConflict('package2', 'conflict2', '1.0.0')

    // Check updated stats
    expect(acknowledgmentStats.value.total_acknowledged).toBe(2)
    expect(acknowledgmentStats.value.unique_packages).toBe(2)
    expect(acknowledgmentStats.value.modal_dismissed).toBe(true)
  })

  it('should use VueUse useStorage for persistence', () => {
    // This test verifies that useStorage is being used by checking
    // that values are automatically synced to localStorage
    const { dismissConflictModal, acknowledgeConflict } =
      useConflictAcknowledgment()

    dismissConflictModal()
    acknowledgeConflict('test-pkg', 'test-conflict', '1.0.0')

    // VueUse useStorage should automatically persist to localStorage
    // We can verify the keys exist (values will be stringified by VueUse)
    expect(
      localStorage.getItem('comfyui.conflict.modal.dismissed')
    ).not.toBeNull()
    expect(localStorage.getItem('comfyui.conflict.acknowledged')).not.toBeNull()
  })
})
