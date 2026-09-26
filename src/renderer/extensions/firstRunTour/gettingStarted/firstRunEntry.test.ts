import { useSettingStore } from '@/platform/settings/settingStore'
import { useAuthStore } from '@/stores/authStore'
import { useCommandStore } from '@/stores/commandStore'
import { fromAny } from '@total-typescript/shoehorn'
import * as VueUse from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import {
  isFirstRunReplayRequested,
  requestOnboardingReplay
} from '@/platform/onboarding/onboardingReplay'
import { reportError } from '@/platform/telemetry/reportError'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import type { SharedWorkflowUrlLoadStatus } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'

const mocks = vi.hoisted<{
  isCloud: boolean
  isDesktopWidth: boolean
  subscriptionEnabled: boolean
  isNewUser: boolean | null
  beginTour: ReturnType<typeof vi.fn>
  trackFirstRunScreenDismissed: ReturnType<typeof vi.fn>
}>(() => ({
  isCloud: true,
  isDesktopWidth: true,
  subscriptionEnabled: true,
  isNewUser: true,

  beginTour: vi.fn(),
  trackFirstRunScreenDismissed: vi.fn()
}))

const sharedComposable = vi.hoisted(() => {
  let reset = () => {}

  function create<T>(composable: () => T): () => T {
    let result: T | undefined
    reset = () => {
      result = undefined
    }
    return () => (result ??= composable())
  }

  return { create, reset: () => reset() }
})

const OWNER_ID = 'account-a'

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

vi.mock(import('@vueuse/core'), { spy: true })
vi.mocked(VueUse.createSharedComposable).mockImplementation(
  sharedComposable.create
)

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

vi.mock<unknown>(import('@/services/useNewUserService'), () => ({
  useNewUserService: () => ({ isNewUser: () => mocks.isNewUser })
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/auth/firebaseIdentity'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({
    trackFirstRunScreenDismissed: mocks.trackFirstRunScreenDismissed
  })
}))
vi.mock<unknown>(import('../tour/useFirstRunTourController'), () => ({
  useFirstRunTourController: () => ({ beginTour: mocks.beginTour })
}))

const { useFirstRunEntry } = await import('./firstRunEntry')

type FirstRunEntry = ReturnType<typeof useFirstRunEntry>

beforeEach(() => {
  vi.mocked(useSubscription().isSubscriptionEnabled).mockImplementation(
    () => mocks.subscriptionEnabled
  )
  vi.mocked(VueUse.useBreakpoints).mockReturnValue(
    fromAny<ReturnType<typeof VueUse.useBreakpoints>, unknown>({
      greaterOrEqual: () => computed(() => mocks.isDesktopWidth)
    })
  )
  vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
})

describe('useFirstRunEntry', () => {
  beforeEach(() => {
    mocks.isCloud = true
    mocks.isDesktopWidth = true
    mocks.subscriptionEnabled = true
    mocks.isNewUser = true
    vi.mocked(firebaseIdentity.onUserChanged).mockReturnValue(() => undefined)
    vi.mocked(firebaseIdentity.onTokenChanged).mockReturnValue(() => undefined)
    Object.assign(useAuthStore(), { userId: OWNER_ID })
    vi.mocked(useFeatureFlags().flags).onboardingTourEnabled = true
    useSettingStore().settingValues = {}
    vi.mocked(useSettingStore().set).mockImplementation(async (key, value) => {
      Object.assign(useSettingStore().settingValues, { [key]: value })
    })
    sharedComposable.reset()
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
    [
      'the tour flag off',
      () => {
        vi.mocked(useFeatureFlags().flags).onboardingTourEnabled = false
      }
    ]
  ] as const

  describe('what the boot reports to surfaces that must yield to it', () => {
    it('records that Getting Started took the screen', async () => {
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('fresh')

      expect(entry.firstRunTookScreen.value).toBe(true)
    })

    it('records that a url-intent tour took the screen', async () => {
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('url-intent')
      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(entry.firstRunTookScreen.value).toBe(true)
    })

    it.for([
      {
        label: 'restored work',
        boot: async (entry: FirstRunEntry) =>
          entry.handleStartupOutcome('restored')
      },
      {
        label: 'a boot that only deferred',
        boot: async (entry: FirstRunEntry) => {
          mocks.isDesktopWidth = false
          await entry.handleStartupOutcome('fresh')
        }
      },
      {
        label: 'a url-intent boot whose tour did not start',
        boot: async (entry: FirstRunEntry) => {
          mocks.beginTour.mockResolvedValue(false)
          await entry.handleStartupOutcome('url-intent')
          await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')
        }
      }
    ])('reports no first-run screen for $label', async ({ boot }) => {
      const entry = useFirstRunEntry()

      await boot(entry)

      expect(entry.firstRunTookScreen.value).toBe(false)
    })

    it('settles a url-intent boot only once the url stage has run', async () => {
      const entry = useFirstRunEntry()
      let decided: boolean | undefined
      void entry.whenStartupDecided().then((value) => {
        decided = value
      })

      await entry.handleStartupOutcome('url-intent')
      await new Promise((resolve) => setTimeout(resolve))
      expect(decided).toBeUndefined()

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')
      await vi.waitFor(() => expect(decided).toBe(true))
    })

    it('settles a fresh boot as soon as the screen stage has run', async () => {
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('fresh')

      await expect(entry.whenStartupDecided()).resolves.toBe(true)
    })

    it('settles even when the screen stage throws', async () => {
      const entry = useFirstRunEntry()
      mocks.isDesktopWidth = false
      vi.mocked(useCommandStore().execute).mockRejectedValue(
        new Error('stale chunk')
      )

      await expect(entry.handleStartupOutcome('fresh')).rejects.toThrow(
        'stale chunk'
      )

      await expect(entry.whenStartupDecided()).resolves.toBe(true)
    })

    it('shares one grace timer across every waiter', async () => {
      const entry = useFirstRunEntry()
      vi.mocked(VueUse.until).mockClear()

      void entry.whenStartupDecided()
      void entry.whenStartupDecided()
      expect(VueUse.until).toHaveBeenCalledOnce()

      await entry.handleStartupOutcome('fresh')
      await expect(entry.whenStartupDecided()).resolves.toBe(true)
      expect(VueUse.until).toHaveBeenCalledOnce()
    })

    it('resolves at once for a subscriber that arrives after the boot reported', async () => {
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')
      await entry.handleUrlWorkflow('fresh')

      await expect(entry.whenStartupDecided()).resolves.toBe(true)
    })

    it('stays undecided while a url-intent tour is still starting', async () => {
      const entry = useFirstRunEntry()
      let start = (_: boolean) => {}
      mocks.beginTour.mockReturnValue(
        new Promise<boolean>((resolve) => {
          start = resolve
        })
      )
      let decided: boolean | undefined
      void entry.whenStartupDecided().then((value) => {
        decided = value
      })

      await entry.handleStartupOutcome('url-intent')
      const urlStage = entry.handleUrlWorkflow(
        'url-intent',
        'image_z_image_turbo'
      )
      await new Promise((resolve) => setTimeout(resolve))
      expect(decided).toBeUndefined()
      expect(entry.firstRunTookScreen.value).toBe(false)

      start(true)
      await urlStage
      await vi.waitFor(() => expect(decided).toBe(true))
      expect(entry.firstRunTookScreen.value).toBe(true)
    })

    it('settles the startup decision even when the tour fails to start', async () => {
      const entry = useFirstRunEntry()
      mocks.beginTour.mockRejectedValue(new Error('offline'))

      await entry.handleStartupOutcome('url-intent')
      await expect(
        entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')
      ).rejects.toThrow('offline')

      await expect(entry.whenStartupDecided()).resolves.toBe(true)
      expect(entry.firstRunTookScreen.value).toBe(false)
    })

    it('gives up with false only once the grace period has fully passed', async () => {
      vi.useFakeTimers()
      try {
        const entry = useFirstRunEntry()
        let decided: boolean | undefined
        void entry.whenStartupDecided().then((value) => {
          decided = value
        })

        await vi.advanceTimersByTimeAsync(59_999)
        expect(decided).toBeUndefined()

        await vi.advanceTimersByTimeAsync(1)
        expect(decided).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('what a fresh user sees', () => {
    it('shows Getting Started to a candidate', async () => {
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('fresh')

      expect(entry.gettingStartedVisible.value).toBe(true)
      expect(useCommandStore().execute).not.toHaveBeenCalled()
    })

    it('shares first-run state across consumers during one boot', async () => {
      const startup = useFirstRunEntry()
      const screen = useFirstRunEntry()

      await startup.handleStartupOutcome('fresh')

      expect(screen.gettingStartedVisible.value).toBe(true)
    })

    it.for([...permanentDisqualifiers, ...transientDisqualifiers])(
      'opens the template browser instead, with %s',
      async ([, disqualify]) => {
        disqualify()
        const entry = useFirstRunEntry()

        await entry.handleStartupOutcome('fresh')

        expect(
          entry.gettingStartedVisible.value,
          'A non-candidate must keep the existing template-browser flow'
        ).toBe(false)
        expect(useCommandStore().execute).toHaveBeenCalledWith(
          'Comfy.BrowseTemplates'
        )
      }
    )

    it.for(permanentDisqualifiers)(
      'marks the tutorial completed for %s, which no later boot can lift',
      async ([, disqualify]) => {
        disqualify()
        const entry = useFirstRunEntry()

        await entry.handleStartupOutcome('fresh')

        expect(
          useSettingStore().set,
          'Without this the browser reopens on every launch, forever'
        ).toHaveBeenCalledWith('Comfy.TutorialCompleted', true)
      }
    )

    it.for(transientDisqualifiers)(
      'leaves the tutorial unmarked for %s, so a later boot can still onboard',
      async ([, disqualify]) => {
        disqualify()
        const entry = useFirstRunEntry()

        await entry.handleStartupOutcome('fresh')

        expect(
          useSettingStore().set,
          'Comfy.TutorialCompleted is write-once and server-side; setting it here burns the tour for an account that was only ineligible this boot'
        ).not.toHaveBeenCalled()
      }
    )

    it('onboards a user whose earlier boot was only transiently ineligible', async () => {
      mocks.isDesktopWidth = false
      const phone = useFirstRunEntry()
      await phone.handleStartupOutcome('fresh')

      mocks.isDesktopWidth = true
      sharedComposable.reset()
      const laptop = useFirstRunEntry()
      await laptop.handleStartupOutcome('fresh')

      expect(
        laptop.gettingStartedVisible.value,
        'signing up on a phone and returning on a laptop is ordinary behaviour'
      ).toBe(true)
    })
  })

  it('marks a url-intent startup completed once its tour starts, without taking over the screen', async () => {
    const entry = useFirstRunEntry()

    await entry.handleStartupOutcome('url-intent')

    expect(
      entry.gettingStartedVisible.value,
      'A share or template link is the user’s choice; onboarding must not cover it'
    ).toBe(false)
    expect(useCommandStore().execute).not.toHaveBeenCalled()

    await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

    expect(
      useSettingStore().set,
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
      const entry = useFirstRunEntry()

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
        useSettingStore().set,
        'no tour ran, so the write-once flag that pays for one must stay unspent for the boot that can lift this'
      ).not.toHaveBeenCalled()
    }
  )

  it('tours a template link on the boot after one that only deferred', async () => {
    mocks.isDesktopWidth = false
    const phone = useFirstRunEntry()
    await phone.handleStartupOutcome('url-intent')
    await phone.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

    expect(mocks.beginTour).not.toHaveBeenCalled()

    mocks.isDesktopWidth = true
    // What `checkIsNewUser()` reads on the next launch.
    mocks.isNewUser =
      !useSettingStore().settingValues['Comfy.TutorialCompleted']
    sharedComposable.reset()
    const laptop = useFirstRunEntry()
    await laptop.handleStartupOutcome('url-intent')
    await laptop.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

    expect(
      mocks.beginTour,
      'opening a template link on a phone and returning on a laptop is ordinary behaviour'
    ).toHaveBeenCalledWith('image_z_image_turbo', expect.any(Function))
    expect(
      useSettingStore().settingValues['Comfy.TutorialCompleted'],
      'the flag is spent on the boot that finally delivered the tour, not before'
    ).toBe(true)
  })

  it('never onboards over restored work, even for an apparent new user', async () => {
    const entry = useFirstRunEntry()

    await entry.handleStartupOutcome('restored')

    expect(
      entry.gettingStartedVisible.value,
      'checkIsNewUser reads Comfy.TutorialCompleted, so a user who predates that setting looks new; only the outcome shows they had work to restore'
    ).toBe(false)
    expect(
      useCommandStore().execute,
      'nor may the template browser cover their restored workflow'
    ).not.toHaveBeenCalled()
  })

  describe('a requested replay', () => {
    beforeEach(() => {
      mocks.isNewUser = false
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = true
    })

    it('onboards over restored work, because this user asked for onboarding', async () => {
      requestOnboardingReplay(OWNER_ID)
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('restored')

      expect(entry.gettingStartedVisible.value).toBe(true)
    })

    it('onboards a returning user whose tutorial is already complete', async () => {
      requestOnboardingReplay(OWNER_ID)
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('fresh')

      expect(entry.gettingStartedVisible.value).toBe(true)
    })

    it('is spent by the boot that shows the screen', async () => {
      requestOnboardingReplay(OWNER_ID)
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('restored')

      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(false)
    })

    it('stands until a boot can show the screen, so eligibility this boot lacked is not lost', async () => {
      requestOnboardingReplay(OWNER_ID)
      mocks.subscriptionEnabled = false
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('fresh')

      expect(entry.gettingStartedVisible.value).toBe(false)
      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(true)
    })

    const cannotServe = [
      ['not on cloud', () => void (mocks.isCloud = false)],
      ['subscription disabled', () => void (mocks.subscriptionEnabled = false)],
      ['below the md breakpoint', () => void (mocks.isDesktopWidth = false)],
      [
        'the tour flag off',
        () => {
          vi.mocked(useFeatureFlags().flags).onboardingTourEnabled = false
        }
      ]
    ] as const

    it.for(cannotServe)(
      'never covers restored work with the template browser when %s',
      async ([, disqualify]) => {
        requestOnboardingReplay(OWNER_ID)
        disqualify()
        const entry = useFirstRunEntry()

        await entry.handleStartupOutcome('restored')

        expect(entry.gettingStartedVisible.value).toBe(false)
        expect(useCommandStore().execute).not.toHaveBeenCalled()
        expect(isFirstRunReplayRequested(OWNER_ID)).toBe(true)
      }
    )

    it('is spent by a link that delivers the tour instead of the screen', async () => {
      requestOnboardingReplay(OWNER_ID)
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('url-intent')
      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(mocks.beginTour).toHaveBeenCalled()
      expect(
        isFirstRunReplayRequested(OWNER_ID),
        'the replay was served as a tour, so a later reload must not re-offer it'
      ).toBe(false)
    })

    it('stands when the link refused to start a tour, which served nothing', async () => {
      requestOnboardingReplay(OWNER_ID)
      mocks.beginTour.mockResolvedValue(false)
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('url-intent')
      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(isFirstRunReplayRequested(OWNER_ID)).toBe(true)
    })

    it('leaves the invariant intact for everyone who did not ask', async () => {
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('restored')

      expect(entry.gettingStartedVisible.value).toBe(false)
    })

    it('hides an active replay when the account changes', async () => {
      requestOnboardingReplay(OWNER_ID)
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('restored')

      Object.assign(useAuthStore(), { userId: 'account-b' })

      expect(entry.gettingStartedVisible.value).toBe(false)
      expect(entry.firstRunTookScreen.value).toBe(false)
    })
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
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome(outcome)
      await finishBoot(entry)

      expect(
        entry.gettingStartedVisible.value ||
          mocks.beginTour.mock.calls.length > 0 ||
          vi.mocked(useSettingStore().set).mock.calls.length > 0 ||
          vi.mocked(useCommandStore().execute).mock.calls.length > 0,
        'a startup that opened a blank canvas must offer onboarding, tour what the link loaded, record that it is done, or open the template browser; anything else strands the user with an empty screen'
      ).toBe(true)
    }
  )

  describe('a workflow that arrived by URL', () => {
    it.for(['loaded', 'loaded-without-assets'] as const)(
      'offers the tour over a shared workflow that %s, which has no template id',
      async (sharedStatus) => {
        const entry = useFirstRunEntry()

        await entry.handleUrlWorkflow('url-intent', undefined, sharedStatus)

        expect(
          mocks.beginTour,
          'a share link is the case no pin can ever cover'
        ).toHaveBeenCalledWith(undefined, expect.any(Function))
      }
    )

    it('passes a template id through so its pins beat the heuristic', async () => {
      const entry = useFirstRunEntry()

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(mocks.beginTour).toHaveBeenCalledWith(
        'image_z_image_turbo',
        expect.any(Function)
      )
    })

    it('drops the template pins when a share link replaced the graph', async () => {
      const entry = useFirstRunEntry()

      await entry.handleUrlWorkflow(
        'url-intent',
        'image_z_image_turbo',
        'loaded'
      )

      expect(
        mocks.beginTour,
        'pinned ids are graph-local, so validating them against a stranger workflow spotlights whichever node happens to share the id'
      ).toHaveBeenCalledWith(undefined, expect.any(Function))
    })

    it('leaves the completion flag alone when the engine refused to start', async () => {
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('url-intent')
      vi.mocked(useSettingStore().set).mockClear()
      mocks.beginTour.mockResolvedValue(false)

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(
        useSettingStore().set,
        'writing it here would mark onboarding done for a user whose tour never started, and postpone() exists to offer that user the tour again'
      ).not.toHaveBeenCalled()
    })

    it('keeps the account eligible when the link loaded nothing to tour', async () => {
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('url-intent')
      await entry.handleUrlWorkflow('url-intent', undefined, 'failed')

      expect(
        mocks.beginTour,
        'there is no workflow on the canvas to tour'
      ).not.toHaveBeenCalled()
      expect(
        useSettingStore().set,
        'a dead link must not spend the one tour the account gets; the next boot has no URL to honour and offers Getting Started instead'
      ).not.toHaveBeenCalled()
    })

    it.for(['failed', 'cancelled', 'not-present'] as const)(
      'offers no tour when nothing the user asked for arrived (%s)',
      async (sharedStatus) => {
        const entry = useFirstRunEntry()

        await entry.handleUrlWorkflow('url-intent', undefined, sharedStatus)

        expect(
          mocks.beginTour,
          'touring a graph the user never asked for is worse than no tour'
        ).not.toHaveBeenCalled()
      }
    )

    it('leaves a non-candidate alone', async () => {
      mocks.isNewUser = false
      const entry = useFirstRunEntry()

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(
        mocks.beginTour,
        'a returning user opening a share link must not be toured'
      ).not.toHaveBeenCalled()
    })

    it.for(['fresh', 'restored'] as const)(
      'does not fire on a %s startup',
      async (outcome: StartupOutcome) => {
        const entry = useFirstRunEntry()

        await entry.handleUrlWorkflow(outcome, 'image_z_image_turbo')

        expect(
          mocks.beginTour,
          'only a URL intent has a workflow on the canvas to tour'
        ).not.toHaveBeenCalled()
      }
    )
  })

  it('leaves a completed user alone', async () => {
    useSettingStore().settingValues['Comfy.TutorialCompleted'] = true
    const entry = useFirstRunEntry()

    await entry.handleStartupOutcome('restored')

    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(useCommandStore().execute).not.toHaveBeenCalled()
    expect(useSettingStore().set).not.toHaveBeenCalled()
  })

  it('keeps the screen up when eligibility changes underneath it', async () => {
    const entry = useFirstRunEntry()
    await entry.handleStartupOutcome('fresh')

    mocks.isDesktopWidth = false
    mocks.subscriptionEnabled = false

    expect(
      entry.gettingStartedVisible.value,
      'Candidacy gates entry only; a resize or flag refresh must not unmount the screen mid-interaction'
    ).toBe(true)
  })

  it('marks the tutorial completed only once the user acts', async () => {
    const entry = useFirstRunEntry()
    await entry.handleStartupOutcome('fresh')

    expect(
      useSettingStore().set,
      'Showing the screen must not persist completion; the user has not chosen anything yet'
    ).not.toHaveBeenCalled()

    await entry.dismissGettingStarted('start_blank')

    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(useSettingStore().set).toHaveBeenCalledWith(
      'Comfy.TutorialCompleted',
      true
    )
  })

  it('reports a tutorial flag write that fails instead of only logging it', async () => {
    const entry = useFirstRunEntry()
    vi.mocked(useSettingStore().set).mockRejectedValue(
      new TypeError('Failed to fetch')
    )

    await entry.dismissGettingStarted('start_blank')

    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      errorType: 'failure_writing_tutorial_completed_setting',
      level: 'warning'
    })
  })
  describe('what it reports when the screen closes', () => {
    it('reports nothing for a screen that is merely up', async () => {
      const entry = useFirstRunEntry()

      await entry.handleStartupOutcome('fresh')

      expect(
        mocks.trackFirstRunScreenDismissed,
        'a standing screen reported per render would make the count a function of session length rather than of closes'
      ).not.toHaveBeenCalled()
    })

    it.for([
      { method: 'start_blank' },
      { method: 'escape' },
      { method: 'template_selected' }
    ] as const)('reports a $method close exactly once', async ({ method }) => {
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')

      await entry.dismissGettingStarted(method)

      expect(
        mocks.trackFirstRunScreenDismissed
      ).toHaveBeenCalledExactlyOnceWith({
        method,
        visible_duration_ms: expect.any(Number)
      })
    })

    it('reports one close however many times the screen is dismissed', async () => {
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')

      await entry.dismissGettingStarted('start_blank')
      await entry.dismissGettingStarted('start_blank')
      await entry.dismissGettingStarted('escape')

      expect(
        mocks.trackFirstRunScreenDismissed,
        'this event is the denominator for the consent card held behind the screen, so a second report of the same close would inflate it'
      ).toHaveBeenCalledExactlyOnceWith({
        method: 'start_blank',
        visible_duration_ms: expect.any(Number)
      })
    })

    it('reports a close the user did not ask for as an account switch', async () => {
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')

      Object.assign(useAuthStore(), { userId: 'account-b' })

      expect(
        entry.gettingStartedVisible.value,
        'the screen belongs to the account that was signed in when it opened'
      ).toBe(false)
      expect(
        mocks.trackFirstRunScreenDismissed,
        'an account switch closing the screen is not a dismissal and must not be counted as one'
      ).toHaveBeenCalledExactlyOnceWith({
        method: 'user_changed',
        visible_duration_ms: expect.any(Number)
      })
    })

    it('measures how long the screen was up', async () => {
      vi.useFakeTimers()
      try {
        const entry = useFirstRunEntry()
        await entry.handleStartupOutcome('fresh')
        vi.advanceTimersByTime(4200)

        await entry.dismissGettingStarted('start_blank')

        expect(
          mocks.trackFirstRunScreenDismissed
        ).toHaveBeenCalledExactlyOnceWith({
          method: 'start_blank',
          visible_duration_ms: 4200
        })
      } finally {
        vi.useRealTimers()
      }
    })

    it('reports nothing when there was no screen to close', async () => {
      const entry = useFirstRunEntry()

      await entry.dismissGettingStarted('start_blank')

      expect(
        mocks.trackFirstRunScreenDismissed,
        'nothing was on screen to close, so there is no close to report'
      ).not.toHaveBeenCalled()
    })
  })

  describe('handing the screen over to the first-run tour', () => {
    /**
     * Stands in for the intro preview `beginTour` waits out before it starts the
     * tour. That the real one exists, and that no tour is active until it is
     * over, is pinned by `useFirstRunTourController.test.ts` ("leaves the
     * workflow undimmed before taking the screen over"); what is pinned here is
     * that the first run keeps hold of the screen for however long it lasts.
     */
    const INTRO_PREVIEW_MS = 500

    function tourOpeningAfterIntroPreview(): Promise<boolean> {
      return new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(true), INTRO_PREVIEW_MS)
      )
    }

    it('dismisses the screen before it asks for the tour', async () => {
      const entry = useFirstRunEntry()
      const order: string[] = []
      vi.mocked(useSettingStore().set).mockImplementation(async (key) => {
        order.push(`set:${key}`)
      })
      mocks.beginTour.mockImplementation(async () => {
        order.push('beginTour')
        return true
      })
      await entry.handleStartupOutcome('fresh')

      await entry.dismissIntoFirstRunTour('image_z_image_turbo')

      expect(
        order,
        'the preview only works on a screen that has already gone'
      ).toEqual(['set:Comfy.TutorialCompleted', 'beginTour'])
    })

    it('holds the screen across the handoff, from the dismissal until the tour opens', async () => {
      vi.useFakeTimers()
      try {
        const entry = useFirstRunEntry()
        mocks.beginTour.mockImplementation(tourOpeningAfterIntroPreview)
        await entry.handleStartupOutcome('fresh')
        expect(entry.firstRunHoldsScreen.value).toBe(true)

        const handoff = entry.dismissIntoFirstRunTour('image_z_image_turbo')
        await vi.advanceTimersByTimeAsync(0)

        expect(
          entry.gettingStartedVisible.value,
          'the screen really is gone - this is not a delayed dismissal'
        ).toBe(false)
        expect(
          entry.firstRunHoldsScreen.value,
          'the canvas belongs to the tour about to open over it, not to whatever asks next'
        ).toBe(true)

        await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS - 1)
        expect(
          entry.firstRunHoldsScreen.value,
          'still inside the preview, so still no tour to yield to'
        ).toBe(true)

        await vi.advanceTimersByTimeAsync(1)
        await handoff
        expect(
          entry.firstRunHoldsScreen.value,
          'the tour is up and holds the screen in its own right from here'
        ).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('releases the screen when the handoff produces no tour', async () => {
      const entry = useFirstRunEntry()
      mocks.beginTour.mockResolvedValue(false)
      await entry.handleStartupOutcome('fresh')

      await entry.dismissIntoFirstRunTour('image_z_image_turbo')

      expect(
        entry.firstRunHoldsScreen.value,
        'a template with no tour leaves a clear canvas, so nothing may stay held on it'
      ).toBe(false)
    })

    it('releases the screen when the tour throws', async () => {
      const entry = useFirstRunEntry()
      mocks.beginTour.mockRejectedValue(new Error('tour unavailable'))
      await entry.handleStartupOutcome('fresh')

      await expect(
        entry.dismissIntoFirstRunTour('image_z_image_turbo')
      ).rejects.toThrow('tour unavailable')

      expect(
        entry.firstRunHoldsScreen.value,
        'a hold that outlives its handoff is the latch this replaced'
      ).toBe(false)
    })
  })
})
