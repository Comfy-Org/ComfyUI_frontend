import { createTestingPinia } from '@pinia/testing'
import userEvent from '@testing-library/user-event'
import { cleanup, render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FirstRunTourNudge from './FirstRunTourNudge.vue'

const APPEAR_DELAY_MS = 1500

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    nudgeArmed: ref(false),
    tourWasShown: ref(true),
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
    tourWasShown: mocks.tourWasShown,
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
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.nudgeArmed.value = false
    mocks.openDialogs.value = []
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
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
      tour: 'firstRun'
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

  it('offers no congratulation for a tour that never appeared', async () => {
    mocks.tourWasShown.value = false
    mocks.nudgeArmed.value = true
    renderNudge()
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(
      screen.queryByText(nudgeCopy.ran.title),
      'a user whose tour never ran made nothing to be congratulated for'
    ).toBeNull()
    expect(screen.getByText(nudgeCopy.noTour.title)).toBeTruthy()
  })

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
      { tour: 'firstRun' }
    )
  })
})
