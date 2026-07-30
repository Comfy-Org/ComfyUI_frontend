import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as VueUseCoreModule from '@vueuse/core'

import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'

type VueUseCore = typeof VueUseCoreModule

const mocks = vi.hoisted(() => ({
  isCloud: true,
  isDesktopWidth: true,
  subscriptionEnabled: true,
  isNewUser: true as boolean | null,
  tourFlag: true,
  execute: vi.fn(),
  settings: {} as Record<string, unknown>,
  setSetting: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<VueUseCore>()),
  useBreakpoints: () => ({
    greaterOrEqual: () => ({
      get value() {
        return mocks.isDesktopWidth
      }
    })
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isSubscriptionEnabled: () => mocks.subscriptionEnabled
  })
}))

vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({ isNewUser: () => mocks.isNewUser })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get onboardingTourEnabled() {
        return mocks.tourFlag
      }
    }
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: mocks.execute })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => mocks.settings[key],
    set: mocks.setSetting
  })
}))

// createSharedComposable caches across calls; each test needs its own instance.
async function freshEntry() {
  vi.resetModules()
  const { useFirstRunEntry } = await import('./firstRunEntry')
  return useFirstRunEntry()
}

describe('useFirstRunEntry', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mocks.isCloud = true
    mocks.isDesktopWidth = true
    mocks.subscriptionEnabled = true
    mocks.isNewUser = true
    mocks.tourFlag = true
    mocks.settings = {}
  })

  describe('what a fresh user sees', () => {
    it('shows Getting Started to a candidate', async () => {
      const entry = await freshEntry()

      await entry.handleStartupOutcome('fresh')

      expect(entry.gettingStartedVisible.value).toBe(true)
      expect(mocks.execute).not.toHaveBeenCalled()
    })

    const disqualifiers: [string, () => void][] = [
      ['not on cloud', () => void (mocks.isCloud = false)],
      ['below the md breakpoint', () => void (mocks.isDesktopWidth = false)],
      ['subscription disabled', () => void (mocks.subscriptionEnabled = false)],
      ['a returning user', () => void (mocks.isNewUser = false)],
      ['new-user state undetermined', () => void (mocks.isNewUser = null)],
      ['the tour flag off', () => void (mocks.tourFlag = false)]
    ]

    it.for(disqualifiers)(
      'opens the template browser instead, with %s',
      async ([, disqualify]) => {
        disqualify()
        const entry = await freshEntry()

        await entry.handleStartupOutcome('fresh')

        expect(
          entry.gettingStartedVisible.value,
          'A non-candidate must keep the existing template-browser flow'
        ).toBe(false)
        expect(mocks.execute).toHaveBeenCalledWith('Comfy.BrowseTemplates')
        expect(
          mocks.setSetting,
          'Without this the browser reopens on every launch, forever'
        ).toHaveBeenCalledWith('Comfy.TutorialCompleted', true)
      }
    )
  })

  it.for(['restored', 'url-intent'] as const)(
    'leaves a %s startup untouched',
    async (outcome: StartupOutcome) => {
      const entry = await freshEntry()

      await entry.handleStartupOutcome(outcome)

      expect(entry.gettingStartedVisible.value).toBe(false)
      expect(mocks.execute).not.toHaveBeenCalled()
      expect(
        mocks.setSetting,
        'A URL intent must not burn the first-run flag; the user never chose anything'
      ).not.toHaveBeenCalled()
    }
  )

  it('keeps the screen up when eligibility changes underneath it', async () => {
    const entry = await freshEntry()
    await entry.handleStartupOutcome('fresh')

    mocks.isDesktopWidth = false
    mocks.tourFlag = false
    mocks.subscriptionEnabled = false

    expect(
      entry.gettingStartedVisible.value,
      'Candidacy gates entry only; a resize or flag refresh must not unmount the screen mid-interaction'
    ).toBe(true)
  })

  it('marks the tutorial completed only once the user acts', async () => {
    const entry = await freshEntry()
    await entry.handleStartupOutcome('fresh')

    expect(
      mocks.setSetting,
      'Showing the screen must not persist completion; a reload here has to re-enter onboarding'
    ).not.toHaveBeenCalled()

    await entry.dismissGettingStarted()

    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(mocks.setSetting).toHaveBeenCalledWith(
      'Comfy.TutorialCompleted',
      true
    )
  })
})
