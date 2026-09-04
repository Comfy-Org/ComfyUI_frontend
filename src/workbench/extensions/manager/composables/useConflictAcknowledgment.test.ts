import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'

const STORAGE_KEYS = [
  'Comfy.ConflictModalDismissed',
  'Comfy.ConflictRedDotDismissed',
  'Comfy.ConflictWarningBannerDismissed'
] as const

function setHasConflicts() {
  useConflictDetectionStore().setConflictedPackages([
    {
      package_id: 'conflicted-package',
      package_name: 'Conflicted package',
      has_conflict: true,
      conflicts: [],
      is_compatible: false
    }
  ])
}

describe('useConflictAcknowledgment', () => {
  beforeEach(async () => {
    localStorage.clear()
    window.dispatchEvent(
      new StorageEvent('storage', { key: null, storageArea: localStorage })
    )
    await nextTick()
  })

  it('loads default state', () => {
    const { acknowledgmentState } = useConflictAcknowledgment()

    expect(acknowledgmentState.value).toEqual({
      modal_dismissed: false,
      red_dot_dismissed: false,
      warning_banner_dismissed: false
    })
  })

  it('loads persisted state', () => {
    for (const key of STORAGE_KEYS) {
      localStorage.setItem(key, 'true')
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: 'true',
          storageArea: localStorage
        })
      )
    }

    const { acknowledgmentState } = useConflictAcknowledgment()

    expect(acknowledgmentState.value).toEqual({
      modal_dismissed: true,
      red_dot_dismissed: true,
      warning_banner_dismissed: true
    })
  })

  it('marks conflicts as seen across every surface and persists them', async () => {
    setHasConflicts()
    const {
      acknowledgmentState,
      markConflictsAsSeen,
      shouldShowConflictModal,
      shouldShowManagerBanner,
      shouldShowRedDot
    } = useConflictAcknowledgment()

    expect(shouldShowConflictModal.value).toBe(true)
    expect(shouldShowManagerBanner.value).toBe(true)
    expect(shouldShowRedDot.value).toBe(true)

    markConflictsAsSeen()
    await nextTick()

    expect(acknowledgmentState.value).toEqual({
      modal_dismissed: true,
      red_dot_dismissed: true,
      warning_banner_dismissed: true
    })
    expect(shouldShowConflictModal.value).toBe(false)
    expect(shouldShowManagerBanner.value).toBe(false)
    expect(shouldShowRedDot.value).toBe(false)
    expect(localStorage.getItem('Comfy.ConflictModalDismissed')).toBe('true')
    expect(localStorage.getItem('Comfy.ConflictRedDotDismissed')).toBe('true')
    expect(localStorage.getItem('Comfy.ConflictWarningBannerDismissed')).toBe(
      'true'
    )
  })

  it('hides conflict indicators when there are no conflicts', () => {
    const { shouldShowManagerBanner, shouldShowRedDot } =
      useConflictAcknowledgment()

    expect(shouldShowManagerBanner.value).toBe(false)
    expect(shouldShowRedDot.value).toBe(false)
  })

  it('dismisses only the red dot when conflicts exist', () => {
    setHasConflicts()
    const {
      dismissRedDotNotification,
      shouldShowConflictModal,
      shouldShowManagerBanner,
      shouldShowRedDot
    } = useConflictAcknowledgment()

    expect(shouldShowRedDot.value).toBe(true)

    dismissRedDotNotification()

    expect(shouldShowConflictModal.value).toBe(true)
    expect(shouldShowManagerBanner.value).toBe(true)
    expect(shouldShowRedDot.value).toBe(false)
  })

  it('dismisses the banner and red dot but leaves the modal visible', () => {
    setHasConflicts()
    const {
      dismissWarningBanner,
      shouldShowConflictModal,
      shouldShowManagerBanner,
      shouldShowRedDot
    } = useConflictAcknowledgment()

    expect(shouldShowManagerBanner.value).toBe(true)
    expect(shouldShowRedDot.value).toBe(true)

    dismissWarningBanner()

    expect(shouldShowConflictModal.value).toBe(true)
    expect(shouldShowManagerBanner.value).toBe(false)
    expect(shouldShowRedDot.value).toBe(false)
  })
})
