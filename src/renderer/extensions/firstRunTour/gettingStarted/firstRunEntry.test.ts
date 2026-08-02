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
  setSetting: vi.fn(),
  beginTour: vi.fn()
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

vi.mock('../tour/useFirstRunTourController', () => ({
  useFirstRunTourController: () => ({ beginTour: mocks.beginTour })
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

  it('marks a url-intent startup completed without taking over the screen', async () => {
    const entry = await freshEntry()

    await entry.handleStartupOutcome('url-intent')

    expect(
      entry.gettingStartedVisible.value,
      'A share or template link is the user’s choice; onboarding must not cover it'
    ).toBe(false)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(
      mocks.setSetting,
      'Without this the template browser reopens on every launch, as it did before this flow existed'
    ).toHaveBeenCalledWith('Comfy.TutorialCompleted', true)
  })

  it('never onboards over restored work, even for an apparent new user', async () => {
    const entry = await freshEntry()

    await entry.handleStartupOutcome('restored')

    expect(
      entry.gettingStartedVisible.value,
      'checkIsNewUser reads Comfy.TutorialCompleted, so a user who predates that setting looks new; only the outcome shows they had work to restore'
    ).toBe(false)
    expect(
      mocks.execute,
      'nor may the template browser cover their restored workflow'
    ).not.toHaveBeenCalled()
  })

  it.for(['fresh', 'url-intent'] as const)(
    'settles the first-run decision on a %s startup rather than leaving it pending',
    async (outcome: StartupOutcome) => {
      const entry = await freshEntry()

      await entry.handleStartupOutcome(outcome)

      expect(
        entry.gettingStartedVisible.value ||
          mocks.setSetting.mock.calls.length > 0,
        'a startup that opened a blank canvas must either offer onboarding or record that it is done; anything else strands the user with no screen and no flag'
      ).toBe(true)
    }
  )

  describe('a workflow that arrived by URL', () => {
    it.for(['loaded', 'loaded-without-assets'] as const)(
      'offers the tour over a shared workflow that %s, which has no template id',
      async (sharedStatus) => {
        const entry = await freshEntry()

        await entry.handleUrlWorkflow('url-intent', undefined, sharedStatus)

        expect(
          mocks.beginTour,
          'a share link is the case no pin can ever cover'
        ).toHaveBeenCalledWith(undefined)
      }
    )

    it('passes a template id through so its pins beat the heuristic', async () => {
      const entry = await freshEntry()

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(mocks.beginTour).toHaveBeenCalledWith('image_z_image_turbo')
    })

    it.for(['failed', 'cancelled', 'not-present'] as const)(
      'offers no tour when nothing the user asked for arrived (%s)',
      async (sharedStatus) => {
        const entry = await freshEntry()

        await entry.handleUrlWorkflow('url-intent', undefined, sharedStatus)

        expect(
          mocks.beginTour,
          'touring a graph the user never asked for is worse than no tour'
        ).not.toHaveBeenCalled()
      }
    )

    it('leaves a non-candidate alone', async () => {
      mocks.isNewUser = false
      const entry = await freshEntry()

      await entry.handleUrlWorkflow('url-intent')

      expect(
        mocks.beginTour,
        'a returning user opening a share link must not be toured'
      ).not.toHaveBeenCalled()
    })

    it.for(['fresh', 'restored'] as const)(
      'does not fire on a %s startup',
      async (outcome: StartupOutcome) => {
        const entry = await freshEntry()

        await entry.handleUrlWorkflow(outcome)

        expect(
          mocks.beginTour,
          'only a URL intent has a workflow on the canvas to tour'
        ).not.toHaveBeenCalled()
      }
    )
  })

  it('leaves a completed user alone', async () => {
    mocks.settings['Comfy.TutorialCompleted'] = true
    const entry = await freshEntry()

    await entry.handleStartupOutcome('restored')

    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.setSetting).not.toHaveBeenCalled()
  })

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
      'Showing the screen must not persist completion; the user has not chosen anything yet'
    ).not.toHaveBeenCalled()

    await entry.dismissGettingStarted()

    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(mocks.setSetting).toHaveBeenCalledWith(
      'Comfy.TutorialCompleted',
      true
    )
  })
})
