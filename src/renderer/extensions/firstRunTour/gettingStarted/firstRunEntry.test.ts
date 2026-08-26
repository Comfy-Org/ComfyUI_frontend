import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as VueUseCoreModule from '@vueuse/core'

import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import type { SharedWorkflowUrlLoadStatus } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'

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

type FirstRunEntry = Awaited<ReturnType<typeof freshEntry>>

describe('useFirstRunEntry', () => {
  beforeEach(() => {
    mocks.isCloud = true
    mocks.isDesktopWidth = true
    mocks.subscriptionEnabled = true
    mocks.isNewUser = true
    mocks.tourFlag = true
    mocks.settings = {}
    mocks.setSetting.mockImplementation((key: string, value: unknown) => {
      mocks.settings[key] = value
    })
    // beginTour reports whether a tour actually started; default to the
    // ordinary case so only tests about a refused start have to say so.
    mocks.beginTour.mockResolvedValue(true)
  })

  const permanentDisqualifiers = [
    ['not on cloud', () => void (mocks.isCloud = false)],
    ['a returning user', () => void (mocks.isNewUser = false)]
  ] as const

  const transientDisqualifiers = [
    ['below the md breakpoint', () => void (mocks.isDesktopWidth = false)],
    ['subscription disabled', () => void (mocks.subscriptionEnabled = false)],
    ['new-user state undetermined', () => void (mocks.isNewUser = null)],
    ['the tour flag off', () => void (mocks.tourFlag = false)]
  ] as const

  describe('what a fresh user sees', () => {
    it('shows Getting Started to a candidate', async () => {
      const entry = await freshEntry()

      await entry.handleStartupOutcome('fresh')

      expect(entry.gettingStartedVisible.value).toBe(true)
      expect(mocks.execute).not.toHaveBeenCalled()
    })

    it.for([...permanentDisqualifiers, ...transientDisqualifiers])(
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
      }
    )

    it.for(permanentDisqualifiers)(
      'marks the tutorial completed for %s, which no later boot can lift',
      async ([, disqualify]) => {
        disqualify()
        const entry = await freshEntry()

        await entry.handleStartupOutcome('fresh')

        expect(
          mocks.setSetting,
          'Without this the browser reopens on every launch, forever'
        ).toHaveBeenCalledWith('Comfy.TutorialCompleted', true)
      }
    )

    it.for(transientDisqualifiers)(
      'leaves the tutorial unmarked for %s, so a later boot can still onboard',
      async ([, disqualify]) => {
        disqualify()
        const entry = await freshEntry()

        await entry.handleStartupOutcome('fresh')

        expect(
          mocks.setSetting,
          'Comfy.TutorialCompleted is write-once and server-side; setting it here burns the tour for an account that was only ineligible this boot'
        ).not.toHaveBeenCalled()
      }
    )

    it('onboards a user whose earlier boot was only transiently ineligible', async () => {
      mocks.isDesktopWidth = false
      const phone = await freshEntry()
      await phone.handleStartupOutcome('fresh')

      mocks.isDesktopWidth = true
      const laptop = await freshEntry()
      await laptop.handleStartupOutcome('fresh')

      expect(
        laptop.gettingStartedVisible.value,
        'signing up on a phone and returning on a laptop is ordinary behaviour'
      ).toBe(true)
    })
  })

  it('marks a url-intent startup completed once its tour starts, without taking over the screen', async () => {
    const entry = await freshEntry()

    await entry.handleStartupOutcome('url-intent')

    expect(
      entry.gettingStartedVisible.value,
      'A share or template link is the user’s choice; onboarding must not cover it'
    ).toBe(false)
    expect(mocks.execute).not.toHaveBeenCalled()

    await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

    expect(
      mocks.setSetting,
      'Without this the template browser reopens on every launch, as it did before this flow existed'
    ).toHaveBeenCalledWith('Comfy.TutorialCompleted', true)
  })

  /** Both shapes of URL a first-run boot can arrive on. */
  const urlArrivals = [
    ['a template link', 'image_z_image_turbo', undefined],
    ['a share link', undefined, 'loaded']
  ] as const satisfies readonly [
    string,
    string | undefined,
    SharedWorkflowUrlLoadStatus | undefined
  ][]

  const deferredUrlBoots = transientDisqualifiers.flatMap(([why, disqualify]) =>
    urlArrivals.map(
      ([arrival, templateId, sharedStatus]) =>
        [
          `${arrival} with ${why}`,
          disqualify,
          templateId,
          sharedStatus
        ] as const
    )
  )

  it.for(deferredUrlBoots)(
    'runs a url-intent boot to the end for %s, offering no tour and keeping eligibility',
    async ([, disqualify, templateId, sharedStatus]) => {
      disqualify()
      const entry = await freshEntry()

      await entry.handleStartupOutcome('url-intent')
      await entry.handleUrlWorkflow('url-intent', templateId, sharedStatus)

      expect(
        mocks.beginTour,
        'an ineligible boot has no tour to give'
      ).not.toHaveBeenCalled()
      expect(
        entry.gettingStartedVisible.value,
        'the link is the user’s choice; onboarding must not cover it'
      ).toBe(false)
      expect(
        mocks.setSetting,
        'no tour ran, so the write-once flag that pays for one must stay unspent for the boot that can lift this'
      ).not.toHaveBeenCalled()
    }
  )

  it('tours a template link on the boot after one that only deferred', async () => {
    mocks.isDesktopWidth = false
    const phone = await freshEntry()
    await phone.handleStartupOutcome('url-intent')
    await phone.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

    expect(mocks.beginTour).not.toHaveBeenCalled()

    mocks.isDesktopWidth = true
    // What `checkIsNewUser()` reads on the next launch.
    mocks.isNewUser = !mocks.settings['Comfy.TutorialCompleted']
    const laptop = await freshEntry()
    await laptop.handleStartupOutcome('url-intent')
    await laptop.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

    expect(
      mocks.beginTour,
      'opening a template link on a phone and returning on a laptop is ordinary behaviour'
    ).toHaveBeenCalledWith('image_z_image_turbo')
    expect(
      mocks.settings['Comfy.TutorialCompleted'],
      'the flag is spent on the boot that finally delivered the tour, not before'
    ).toBe(true)
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

  /**
   * A `url-intent` boot only settles once `handleUrlWorkflow` has seen what the
   * link loaded, so the invariant is asserted over the pair of handlers that
   * GraphCanvas awaits in turn, not over the first one alone.
   */
  const startups: [StartupOutcome, (entry: FirstRunEntry) => Promise<void>][] =
    [
      ['fresh', async () => {}],
      [
        'url-intent',
        (entry) => entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')
      ]
    ]

  it.for(startups)(
    'settles the first-run decision on a %s startup rather than leaving it pending',
    async ([outcome, finishBoot]) => {
      const entry = await freshEntry()

      await entry.handleStartupOutcome(outcome)
      await finishBoot(entry)

      expect(
        entry.gettingStartedVisible.value ||
          mocks.beginTour.mock.calls.length > 0 ||
          mocks.setSetting.mock.calls.length > 0 ||
          mocks.execute.mock.calls.length > 0,
        'a startup that opened a blank canvas must offer onboarding, tour what the link loaded, record that it is done, or open the template browser; anything else strands the user with an empty screen'
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

    it('drops the template pins when a share link replaced the graph', async () => {
      const entry = await freshEntry()

      await entry.handleUrlWorkflow(
        'url-intent',
        'image_z_image_turbo',
        'loaded'
      )

      expect(
        mocks.beginTour,
        'pinned ids are graph-local, so validating them against a stranger workflow spotlights whichever node happens to share the id'
      ).toHaveBeenCalledWith(undefined)
    })

    it('leaves the completion flag alone when the engine refused to start', async () => {
      const entry = await freshEntry()
      await entry.handleStartupOutcome('url-intent')
      mocks.setSetting.mockClear()
      mocks.beginTour.mockResolvedValue(false)

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(
        mocks.setSetting,
        'writing it here would mark onboarding done for a user whose tour never started, and postpone() exists to offer that user the tour again'
      ).not.toHaveBeenCalled()
    })

    it('keeps the account eligible when the link loaded nothing to tour', async () => {
      const entry = await freshEntry()

      await entry.handleStartupOutcome('url-intent')
      await entry.handleUrlWorkflow('url-intent', undefined, 'failed')

      expect(
        mocks.beginTour,
        'there is no workflow on the canvas to tour'
      ).not.toHaveBeenCalled()
      expect(
        mocks.setSetting,
        'a dead link must not spend the one tour the account gets; the next boot has no URL to honour and offers Getting Started instead'
      ).not.toHaveBeenCalled()
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

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(
        mocks.beginTour,
        'a returning user opening a share link must not be toured'
      ).not.toHaveBeenCalled()
    })

    it.for(['fresh', 'restored'] as const)(
      'does not fire on a %s startup',
      async (outcome: StartupOutcome) => {
        const entry = await freshEntry()

        await entry.handleUrlWorkflow(outcome, 'image_z_image_turbo')

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
