import * as VueUse from '@vueuse/core'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import type { SharedWorkflowUrlLoadStatus } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useAuthStore } from '@/stores/authStore'

const mocks = vi.hoisted(() => ({
  isCloud: true,
  isDesktopWidth: true,
  subscriptionEnabled: true,
  isNewUser: true as boolean | null,
  tourFlag: true,
  execute: vi.fn(),
  settings: {} as Record<string, unknown>,
  setSetting: vi.fn(),
  beginTour: vi.fn(),
  cancelPendingStart: vi.fn(async () => {})
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

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  return {
    ...actual,
    until: vi.fn(actual.until),
    breakpointsTailwind: {},
    createSharedComposable: sharedComposable.create,
    useBreakpoints: () => ({
      greaterOrEqual: () => ({
        get value() {
          return mocks.isDesktopWidth
        }
      })
    })
  }
})

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

vi.mock('@/stores/authStore', async () => {
  const { reactive } = await import('vue')
  const authStore = reactive({ userId: 'account-a' })
  return { useAuthStore: () => authStore }
})

vi.mock('@/platform/onboarding/onboardingTourStore', async () => {
  const { reactive } = await import('vue')
  const tourStore = reactive({ activeTour: null, postpone: vi.fn() })
  return { useOnboardingTourStore: () => tourStore }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => mocks.settings[key],
    set: mocks.setSetting
  })
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

vi.mock('../tour/useFirstRunTourController', () => ({
  useFirstRunTourController: () => ({
    beginTour: mocks.beginTour,
    cancelPendingStart: mocks.cancelPendingStart
  })
}))

import { useFirstRunEntry } from './firstRunEntry'

type FirstRunEntry = ReturnType<typeof useFirstRunEntry>

describe('useFirstRunEntry', () => {
  beforeEach(() => {
    mocks.isCloud = true
    mocks.isDesktopWidth = true
    mocks.subscriptionEnabled = true
    mocks.isNewUser = true
    mocks.tourFlag = true
    mocks.settings = {}
    Object.assign(useAuthStore(), { userId: 'account-a' })
    mocks.cancelPendingStart.mockClear()
    mocks.setSetting.mockImplementation((key: string, value: unknown) => {
      mocks.settings[key] = value
    })
    sharedComposable.reset()
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

  describe('what the boot reports to surfaces that must yield to it', () => {
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
      mocks.execute.mockRejectedValueOnce(new Error('stale chunk'))

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

      start(true)
      await urlStage
      await vi.waitFor(() => expect(decided).toBe(true))
    })

    it('settles the startup decision even when the tour fails to start', async () => {
      const entry = useFirstRunEntry()
      mocks.beginTour.mockRejectedValue(new Error('offline'))

      await entry.handleStartupOutcome('url-intent')
      await expect(
        entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')
      ).rejects.toThrow('offline')

      await expect(entry.whenStartupDecided()).resolves.toBe(true)
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
      expect(mocks.execute).not.toHaveBeenCalled()
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
        expect(mocks.execute).toHaveBeenCalledWith('Comfy.BrowseTemplates')
      }
    )

    it.for(permanentDisqualifiers)(
      'marks the tutorial completed for %s, which no later boot can lift',
      async ([, disqualify]) => {
        disqualify()
        const entry = useFirstRunEntry()

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
        const entry = useFirstRunEntry()

        await entry.handleStartupOutcome('fresh')

        expect(
          mocks.setSetting,
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
        mocks.setSetting,
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
    mocks.isNewUser = !mocks.settings['Comfy.TutorialCompleted']
    sharedComposable.reset()
    const laptop = useFirstRunEntry()
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
    const entry = useFirstRunEntry()

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
      const entry = useFirstRunEntry()

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
        const entry = useFirstRunEntry()

        await entry.handleUrlWorkflow('url-intent', undefined, sharedStatus)

        expect(
          mocks.beginTour,
          'a share link is the case no pin can ever cover'
        ).toHaveBeenCalledWith(undefined)
      }
    )

    it('passes a template id through so its pins beat the heuristic', async () => {
      const entry = useFirstRunEntry()

      await entry.handleUrlWorkflow('url-intent', 'image_z_image_turbo')

      expect(mocks.beginTour).toHaveBeenCalledWith('image_z_image_turbo')
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
      ).toHaveBeenCalledWith(undefined)
    })

    it('leaves the completion flag alone when the engine refused to start', async () => {
      const entry = useFirstRunEntry()
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
      const entry = useFirstRunEntry()

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
    mocks.settings['Comfy.TutorialCompleted'] = true
    const entry = useFirstRunEntry()

    await entry.handleStartupOutcome('restored')

    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.setSetting).not.toHaveBeenCalled()
  })

  it('keeps the screen up when eligibility changes underneath it', async () => {
    const entry = useFirstRunEntry()
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
    const entry = useFirstRunEntry()
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

  it('reports a tutorial flag write that fails instead of only logging it', async () => {
    const entry = useFirstRunEntry()
    mocks.setSetting.mockRejectedValue(new TypeError('Failed to fetch'))

    await entry.dismissGettingStarted()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      errorType: 'failure_writing_tutorial_completed_setting',
      level: 'warning'
    })
  })

  describe('handing the screen over to the first-run tour', () => {
    it('hides the screen before it asks for the tour', async () => {
      const entry = useFirstRunEntry()
      mocks.beginTour.mockImplementation(async () => {
        expect(entry.gettingStartedVisible.value).toBe(false)
        return true
      })
      await entry.handleStartupOutcome('fresh')

      await entry.dismissIntoFirstRunTour('image_z_image_turbo')

      expect(mocks.beginTour).toHaveBeenCalledOnce()
    })

    it('holds the screen across the handoff, from the dismissal until the tour opens', async () => {
      let finishTour: ((started: boolean) => void) | undefined
      mocks.beginTour.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            finishTour = resolve
          })
      )
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')

      const handoff = entry.dismissIntoFirstRunTour('image_z_image_turbo')
      await vi.waitFor(() => expect(finishTour).toBeTypeOf('function'))

      expect(entry.gettingStartedVisible.value).toBe(false)
      expect(entry.firstRunHoldsScreen.value).toBe(true)

      assert.exists(finishTour)
      finishTour(true)
      await handoff
      expect(entry.firstRunHoldsScreen.value).toBe(false)
    })

    it('releases the screen when the handoff produces no tour', async () => {
      const entry = useFirstRunEntry()
      mocks.beginTour.mockResolvedValue(false)
      await entry.handleStartupOutcome('fresh')

      await entry.dismissIntoFirstRunTour('image_z_image_turbo')

      expect(entry.firstRunHoldsScreen.value).toBe(false)
    })

    it('releases the screen when the tour throws', async () => {
      const entry = useFirstRunEntry()
      mocks.beginTour.mockRejectedValue(new Error('tour unavailable'))
      await entry.handleStartupOutcome('fresh')

      await expect(
        entry.dismissIntoFirstRunTour('image_z_image_turbo')
      ).rejects.toThrow('tour unavailable')

      expect(entry.firstRunHoldsScreen.value).toBe(false)
    })

    it('cancels a deferred handoff across an account round trip', async () => {
      let finishDismissal: (() => void) | undefined
      vi.mocked(useSettingStore().set).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishDismissal = resolve
          })
      )
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')

      const handoff = entry.dismissIntoFirstRunTour('image_z_image_turbo')
      await vi.waitFor(() => expect(finishDismissal).toBeTypeOf('function'))
      Object.assign(useAuthStore(), { userId: 'account-b' })
      Object.assign(useAuthStore(), { userId: 'account-a' })
      assert.exists(finishDismissal)
      finishDismissal()
      await handoff

      expect(mocks.beginTour).not.toHaveBeenCalled()
    })

    it('releases a pending handoff hold at the account boundary', async () => {
      let finishTour: ((started: boolean) => void) | undefined
      mocks.beginTour.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            finishTour = resolve
          })
      )
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')

      const handoff = entry.dismissIntoFirstRunTour('image_z_image_turbo')
      await vi.waitFor(() => expect(mocks.beginTour).toHaveBeenCalled())
      expect(entry.firstRunHoldsScreen.value).toBe(true)

      Object.assign(useAuthStore(), { userId: 'account-b' })

      expect(entry.firstRunHoldsScreen.value).toBe(false)
      expect(mocks.cancelPendingStart).toHaveBeenCalled()
      assert.exists(finishTour)
      finishTour(false)
      await handoff
      expect(entry.firstRunHoldsScreen.value).toBe(false)
    })

    it("keeps account B's hold when account A's stale handoff completes", async () => {
      const finishTours: Array<(started: boolean) => void> = []
      mocks.beginTour.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            finishTours.push(resolve)
          })
      )
      const entry = useFirstRunEntry()
      await entry.handleStartupOutcome('fresh')

      const accountAHandoff = entry.dismissIntoFirstRunTour(
        'image_z_image_turbo'
      )
      await vi.waitFor(() => expect(finishTours).toHaveLength(1))
      Object.assign(useAuthStore(), { userId: 'account-b' })
      const accountBHandoff = entry.dismissIntoFirstRunTour(
        'image_z_image_turbo'
      )
      await vi.waitFor(() => expect(finishTours).toHaveLength(2))

      const [finishAccountA, finishAccountB] = finishTours
      assert.exists(finishAccountA)
      finishAccountA(false)
      await accountAHandoff
      expect(entry.firstRunHoldsScreen.value).toBe(true)

      assert.exists(finishAccountB)
      finishAccountB(false)
      await accountBHandoff
      expect(entry.firstRunHoldsScreen.value).toBe(false)
    })
  })
})
