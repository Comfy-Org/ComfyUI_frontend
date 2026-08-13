import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FirstRunTourNudge from './FirstRunTourNudge.vue'

const APPEAR_DELAY_MS = 1500

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    nudgeArmed: ref(false),
    tourWasCompleted: ref(true),
    openDialogs: ref<string[]>([]),
    dismissNudge: vi.fn(() => {
      mocks.nudgeArmed.value = false
    }),
    showTemplates: vi.fn(),
    trackOnboardingTour: vi.fn()
  }
})

vi.mock('../tour/useFirstRunTourController', () => ({
  useFirstRunTourController: () => ({
    nudgeArmed: mocks.nudgeArmed,
    tourWasCompleted: mocks.tourWasCompleted,
    dismissNudge: mocks.dismissNudge
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    get dialogStack() {
      return mocks.openDialogs.value
    }
  })
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: mocks.showTemplates })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackOnboardingTour: mocks.trackOnboardingTour })
}))

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
    mocks.openDialogs.value = []
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
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith('nudge_shown', {
      tour: 'firstRun',
      tour_completed: true
    })
  })

  it('waits out a dialog that is already open', async () => {
    mocks.nudgeArmed.value = true
    mocks.openDialogs.value = ['some-dialog']
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    expect(
      nudge(),
      'the nudge sits below the modal stack, so under a dialog it is invisible'
    ).toBeNull()

    mocks.openDialogs.value = []
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
    mocks.openDialogs.value = ['some-dialog']
    await vi.advanceTimersByTimeAsync(500 + APPEAR_DELAY_MS)

    expect(
      nudge(),
      'a nudge that came due behind a dialog would land on top of the modal'
    ).toBeNull()
    expect(
      mocks.trackOnboardingTour,
      'a nudge nobody can see has not been shown'
    ).not.toHaveBeenCalledWith('nudge_shown', expect.anything())
  })

  it('reports one nudge once, however often it comes and goes', async () => {
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    mocks.openDialogs.value = ['some-dialog']
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    mocks.openDialogs.value = []
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    const shown = mocks.trackOnboardingTour.mock.calls.filter(
      ([stage]) => stage === 'nudge_shown'
    )
    expect(
      shown,
      'the funnel counts nudges, so a reappearance is not a second one'
    ).toHaveLength(1)
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
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith(
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
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith('nudge_shown', {
      tour: 'firstRun',
      tour_completed: false
    })
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith(
      'explore_templates_clicked',
      { tour: 'firstRun', tour_completed: false }
    )
  })
})
