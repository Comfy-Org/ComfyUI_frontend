import { useDialogStore } from '@/stores/dialogStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  clearCoachmarks,
  registerCoachmark,
  unregisterCoachmark
} from '@/platform/onboarding/coachmarkRegistry'
import { laidOut } from '@/platform/onboarding/fixtures/coachmarkTargets'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import {
  FIRST_RUN_COACH_IDS,
  TOUR_SEEN_SETTING,
  registerTour
} from '@/platform/onboarding/onboardingTours'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FirstRunTourNudge from './FirstRunTourNudge.vue'

const APPEAR_DELAY_MS = 1500
const BUTTON = new DOMRect(600, 300, 48, 48)
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 500

function resizeWindow(width: number) {
  window.innerWidth = width
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: width
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 800
  })
  window.dispatchEvent(new Event('resize'))
}

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    nudgeArmed: ref(false),
    tourWasCompleted: ref(true),
    dismissNudge: vi.fn(() => {
      mocks.nudgeArmed.value = false
    }),
    showTemplates: vi.fn()
  }
})

vi.mock<unknown>(import('../tour/useFirstRunTourController'), () => ({
  useFirstRunTourController: () => ({
    nudgeArmed: mocks.nudgeArmed,
    tourWasCompleted: mocks.tourWasCompleted,
    dismissNudge: mocks.dismissNudge
  })
}))

vi.mock<unknown>(
  import('@/composables/useWorkflowTemplateSelectorDialog'),
  () => ({
    useWorkflowTemplateSelectorDialog: () => ({ show: mocks.showTemplates })
  })
)

vi.mock(import('@/platform/telemetry'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderNudge() {
  return render(FirstRunTourNudge, { global: { plugins: [i18n] } })
}

const nudgeCopy = enMessages.onboardingCoachmarks.firstRun.nudge

function nudge() {
  return screen.queryByTestId('first-run-nudge')
}

describe('FirstRunTourNudge', () => {
  beforeEach(() => {
    mocks.nudgeArmed.value = false
    mocks.tourWasCompleted.value = true
    useDialogStore().dialogStack = []
    clearCoachmarks()
    registerCoachmark(FIRST_RUN_COACH_IDS.templatesButton, laidOut())
    resizeWindow(DESKTOP_WIDTH)
  })

  it('shows a nudge that came due before it mounted', async () => {
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS - 1)
    expect(
      nudge(),
      'arriving on top of the result the user just made buries it'
    ).toBeNull()

    await vi.advanceTimersByTimeAsync(1)

    expect(
      nudge(),
      'a nudge armed before this mounted still has to appear'
    ).not.toBeNull()
    expect(useTelemetry()?.trackOnboardingTour).toHaveBeenCalledWith(
      'nudge_shown',
      {
        tour: 'firstRun',
        tour_completed: true
      }
    )
  })

  it('waits out a dialog that is already open', async () => {
    mocks.nudgeArmed.value = true
    useDialogStore().dialogStack = [fromPartial({ key: 'some-dialog' })]
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    expect(
      nudge(),
      'the nudge sits below the modal stack, so under a dialog it is invisible'
    ).toBeNull()

    useDialogStore().dialogStack = []
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(
      nudge(),
      'the dialog was already open at mount, so no open-to-closed edge ever fired'
    ).not.toBeNull()
  })

  it('waits out a dialog that opens while it is still on its way', async () => {
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS - 500)
    useDialogStore().dialogStack = [fromPartial({ key: 'some-dialog' })]
    await vi.advanceTimersByTimeAsync(500 + APPEAR_DELAY_MS)

    expect(
      nudge(),
      'a nudge that came due behind a dialog would land on top of the modal'
    ).toBeNull()
    expect(
      useTelemetry()?.trackOnboardingTour,
      'a nudge nobody can see has not been shown'
    ).not.toHaveBeenCalledWith('nudge_shown', expect.anything())
  })

  it('reports one nudge once, however often it comes and goes', async () => {
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    useDialogStore().dialogStack = [fromPartial({ key: 'some-dialog' })]
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    useDialogStore().dialogStack = []
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    const shown = vi
      .mocked(useTelemetry()?.trackOnboardingTour)
      ?.mock.calls.filter(([stage]) => stage === 'nudge_shown')
    expect(
      shown,
      'the funnel counts nudges, so a reappearance is not a second one'
    ).toHaveLength(1)
  })

  it('waits for a Templates button to point at', async () => {
    clearCoachmarks()
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    expect(
      nudge(),
      'builder mode has no sidebar, and a nudge pointing at nothing is noise'
    ).toBeNull()

    registerCoachmark(FIRST_RUN_COACH_IDS.templatesButton, laidOut())
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(nudge()).not.toBeNull()
  })

  it('leaves once the Templates button goes away', async () => {
    const button = laidOut()
    clearCoachmarks()
    registerCoachmark(FIRST_RUN_COACH_IDS.templatesButton, button)
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    unregisterCoachmark(FIRST_RUN_COACH_IDS.templatesButton, button)
    await vi.advanceTimersByTimeAsync(0)

    expect(nudge()).toBeNull()
  })

  it.for([
    {
      blocker: 'agent node selection hides the sidebar',
      block: () => {
        useCanvasStore().isPickingNodes = true
      },
      clear: () => {
        useCanvasStore().isPickingNodes = false
      }
    },
    {
      blocker: 'a sidebar panel is open beside the button',
      block: () => {
        const sidebar = useSidebarTabStore()
        sidebar.sidebarTabs = [fromPartial({ id: 'node-library' })]
        sidebar.activeSidebarTabId = 'node-library'
      },
      clear: () => {
        useSidebarTabStore().activeSidebarTabId = null
      }
    }
  ])('waits while $blocker', async ({ block, clear }) => {
    block()
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    expect(nudge()).toBeNull()

    clear()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(nudge()).not.toBeNull()
  })

  it.for([
    {
      blocker: 'a tour is running',
      block: () => {
        useSettingStore().settingValues[TOUR_SEEN_SETTING] = []
        registerTour('firstRun', [{ kind: 'landing', name: 'landing' }])
        useOnboardingTourStore().replayTour('firstRun')
      },
      clear: () => useOnboardingTourStore().skip()
    },
    {
      blocker: 'the window is narrower than the onboarding layout',
      block: () => resizeWindow(MOBILE_WIDTH),
      clear: () => resizeWindow(DESKTOP_WIDTH)
    }
  ])('also waits while $blocker', async ({ block, clear }) => {
    block()
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    expect(nudge()).toBeNull()

    clear()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(nudge()).not.toBeNull()
  })

  it.for([
    { location: 'left', side: 'right of' },
    { location: 'right', side: 'left of' }
  ] as const)(
    'with the sidebar on the $location, sits $side the Templates button',
    async ({ location }) => {
      useSettingStore().settingValues['Comfy.Sidebar.Location'] = location
      clearCoachmarks()
      registerCoachmark(FIRST_RUN_COACH_IDS.templatesButton, laidOut(BUTTON))
      mocks.nudgeArmed.value = true
      renderNudge()
      await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

      const cardLeft = parseFloat(nudge()!.style.left)
      if (location === 'left') {
        expect(cardLeft).toBeGreaterThanOrEqual(BUTTON.right)
      } else {
        expect(
          cardLeft,
          'a right sidebar sits beside the docked Agent panel, so the card must open toward the canvas'
        ).toBeLessThan(BUTTON.left)
      }
    }
  )

  it('brings a scrolled-away Templates button into view before pointing at it', async () => {
    const button = laidOut(BUTTON)
    const scrollIntoView = vi.spyOn(button, 'scrollIntoView')
    clearCoachmarks()
    registerCoachmark(FIRST_RUN_COACH_IDS.templatesButton, button)
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(
      scrollIntoView,
      'on a short window the sidebar scrolls, and a pointer at a hidden button points at nothing'
    ).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('congratulates a tour the user walked to the end', async () => {
    mocks.tourWasCompleted.value = true
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(screen.getByText(nudgeCopy.ran.title)).toBeTruthy()
  })

  it('offers no congratulation for a tour nobody finished', async () => {
    mocks.tourWasCompleted.value = false
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(
      screen.queryByText(nudgeCopy.ran.title),
      'a user who skipped, was cut off or saw no tour made no first result'
    ).toBeNull()
    expect(screen.getByText(nudgeCopy.noTour.title)).toBeTruthy()
  })

  it.for([{ finished: true }, { finished: false }])(
    'appears whether or not the tour finished ($finished)',
    async ({ finished }) => {
      mocks.tourWasCompleted.value = finished
      mocks.nudgeArmed.value = true
      renderNudge()
      await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

      expect(
        nudge(),
        'the copy is all that the ending changes; the way forward is offered either way'
      ).not.toBeNull()
    }
  )

  it('stays gone once the user closes it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    await user.click(screen.getByRole('button', { name: enMessages.g.close }))

    expect(mocks.dismissNudge).toHaveBeenCalled()
    expect(nudge()).toBeNull()
  })

  it.for([
    {
      gesture: 'clicks outside it',
      act: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(document.body)
    },
    {
      gesture: 'presses Escape',
      act: (user: ReturnType<typeof userEvent.setup>) =>
        user.keyboard('{Escape}')
    }
  ])('stays gone once the user $gesture', async ({ act }) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    await act(user)

    expect(mocks.dismissNudge).toHaveBeenCalled()
    expect(nudge()).toBeNull()
  })

  it('stays open while the user reads it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    await user.click(screen.getByText(nudgeCopy.ran.body))

    expect(
      nudge(),
      'a click inside the card is not a request to close it'
    ).not.toBeNull()
  })

  it('stays gone once the user waves it away', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    await user.click(screen.getByText(nudgeCopy.dismiss))

    expect(nudge()).toBeNull()
  })

  it('takes the user to the templates it is pointing at', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    await user.click(screen.getByTestId('first-run-nudge-explore'))

    expect(
      mocks.showTemplates,
      'the source is what separates a nudge conversion from a command-palette one, and it defaults to command'
    ).toHaveBeenCalledWith('first_run_nudge')
    expect(mocks.dismissNudge).toHaveBeenCalled()
    expect(useTelemetry()?.trackOnboardingTour).toHaveBeenCalledWith(
      'explore_templates_clicked',
      { tour: 'firstRun', tour_completed: true }
    )
  })

  it('separates a conversion from a completed tour from one that never ran', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.tourWasCompleted.value = false
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    await user.click(screen.getByTestId('first-run-nudge-explore'))

    // Both events carry it, so the funnel can be read end to end: without it
    // a conversion from a finished tour and one from a tour that never
    // started are indistinguishable.
    expect(useTelemetry()?.trackOnboardingTour).toHaveBeenCalledWith(
      'nudge_shown',
      {
        tour: 'firstRun',
        tour_completed: false
      }
    )
    expect(useTelemetry()?.trackOnboardingTour).toHaveBeenCalledWith(
      'explore_templates_clicked',
      { tour: 'firstRun', tour_completed: false }
    )
  })
})
