import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FirstRunTourNudge from './FirstRunTourNudge.vue'

const APPEAR_DELAY_MS = 1500
const FIRST_OUTPUT = {
  filename: 'first-output.png',
  subfolder: 'tour',
  type: 'output' as const
}
type SuggestionId = 'animate' | 'upscale' | 'restyle'

const SUGGESTION_TITLES: Record<SuggestionId, string> = {
  animate: enMessages.onboardingCoachmarks.firstRun.nudge.animate.title,
  upscale: enMessages.onboardingCoachmarks.firstRun.nudge.upscale.title,
  restyle: enMessages.onboardingCoachmarks.firstRun.nudge.restyle.title
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolveFn) => {
    resolve = resolveFn
  })
  return { promise, resolve }
}

const mocks = await vi.hoisted(async () => {
  const { ref, shallowRef } = await import('vue')
  return {
    nudgeArmed: ref(false),
    nudgeOutput: shallowRef({
      filename: 'first-output.png',
      subfolder: 'tour',
      type: 'output' as const
    }),
    tourWasCompleted: ref(true),
    openDialogs: ref<string[]>([]),
    dismissNudge: vi.fn(() => {
      mocks.nudgeArmed.value = false
    }),
    showTemplates: vi.fn(),
    trackOnboardingTour: vi.fn(),
    loadTemplates: vi.fn().mockResolvedValue(true),
    loadWorkflowTemplate: vi.fn().mockResolvedValue(true),
    addToast: vi.fn()
  }
})

vi.mock('../tour/useFirstRunTourController', () => ({
  useFirstRunTourController: () => ({
    nudgeArmed: mocks.nudgeArmed,
    nudgeOutput: mocks.nudgeOutput,
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

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      loadTemplates: mocks.loadTemplates,
      loadWorkflowTemplate: mocks.loadWorkflowTemplate
    })
  })
)

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mocks.addToast })
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

function nudge() {
  return screen.queryByTestId('first-run-nudge')
}

function suggestionButton(id: SuggestionId) {
  return screen.getByRole('button', {
    name: new RegExp(SUGGESTION_TITLES[id], 'i')
  })
}

async function showNudge() {
  mocks.nudgeArmed.value = true
  renderNudge()
  await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
}

describe('FirstRunTourNudge', () => {
  beforeEach(() => {
    mocks.nudgeArmed.value = false
    mocks.nudgeOutput.value = FIRST_OUTPUT
    mocks.tourWasCompleted.value = true
    mocks.openDialogs.value = []
    mocks.loadTemplates.mockResolvedValue(true)
    mocks.loadWorkflowTemplate.mockResolvedValue(true)
  })

  it('appears after the result has had time to land', async () => {
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS - 1)
    expect(nudge()).toBeNull()

    await vi.advanceTimersByTimeAsync(1)

    expect(
      screen.getByText(enMessages.onboardingCoachmarks.firstRun.nudge.title)
    ).toBeTruthy()
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith('nudge_shown', {
      tour: 'firstRun',
      tour_completed: true
    })
  })

  it('waits until the modal stack is clear', async () => {
    mocks.nudgeArmed.value = true
    mocks.openDialogs.value = ['some-dialog']
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    expect(nudge()).toBeNull()

    mocks.openDialogs.value = []
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(nudge()).not.toBeNull()
  })

  it('closes from the full close control and Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await showNudge()

    await user.click(screen.getByRole('button', { name: enMessages.g.close }))
    expect(mocks.dismissNudge).toHaveBeenCalled()

    mocks.nudgeArmed.value = true
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    await user.keyboard('{Escape}')
    expect(mocks.dismissNudge).toHaveBeenCalledTimes(2)
  })

  it.for([
    {
      id: 'animate',
      templateId: 'video_minimax_h3_i2v_continuation'
    },
    {
      id: 'upscale',
      templateId: 'utility_interpolation_image_upscale_4x'
    },
    {
      id: 'restyle',
      templateId: 'api_google_nano_banana2_image_edit_continuation'
    }
  ] as const)(
    'continues the first output through $id',
    async ({ id, templateId }) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await showNudge()

      await user.click(suggestionButton(id))

      expect(mocks.loadTemplates).toHaveBeenCalled()
      expect(mocks.loadWorkflowTemplate).toHaveBeenCalledWith(
        templateId,
        'default',
        { input: FIRST_OUTPUT }
      )
      expect(mocks.dismissNudge).toHaveBeenCalled()
    }
  )

  it('exposes the pending continuation and blocks competing actions', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const templatesLoaded = createDeferred<boolean>()
    mocks.loadTemplates.mockReturnValueOnce(templatesLoaded.promise)
    await showNudge()

    const animate = suggestionButton('animate')
    await user.click(animate)

    expect(animate).toHaveAttribute('aria-busy', 'true')
    expect(animate).toBeDisabled()
    expect(suggestionButton('upscale')).toBeDisabled()
    expect(suggestionButton('restyle')).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: enMessages.onboardingCoachmarks.firstRun.nudge.explore
      })
    ).toBeDisabled()

    templatesLoaded.resolve(true)
    await vi.waitFor(() => {
      expect(mocks.loadWorkflowTemplate).toHaveBeenCalled()
      expect(mocks.dismissNudge).toHaveBeenCalled()
    })
  })

  it('keeps the card open when the template catalog fails to load', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.loadTemplates.mockResolvedValue(false)
    await showNudge()

    await user.click(suggestionButton('animate'))

    expect(mocks.loadWorkflowTemplate).not.toHaveBeenCalled()
    expect(mocks.dismissNudge).not.toHaveBeenCalled()
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('keeps the card open and reports a template load failure', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.loadWorkflowTemplate.mockResolvedValue(false)
    await showNudge()

    await user.click(suggestionButton('animate'))

    expect(mocks.dismissNudge).not.toHaveBeenCalled()
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('opens the existing template browser from the footer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await showNudge()

    await user.click(
      screen.getByRole('button', {
        name: enMessages.onboardingCoachmarks.firstRun.nudge.explore
      })
    )

    expect(mocks.showTemplates).toHaveBeenCalledWith('first_run_nudge')
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith(
      'explore_templates_clicked',
      { tour: 'firstRun', tour_completed: true }
    )
    expect(mocks.dismissNudge).toHaveBeenCalled()
  })
})
