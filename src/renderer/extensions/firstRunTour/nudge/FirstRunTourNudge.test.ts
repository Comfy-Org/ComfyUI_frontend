import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FirstRunTourNudge from './FirstRunTourNudge.vue'

const APPEAR_DELAY_MS = 1500
const CATALOG_WAIT_MS = 3000
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

const CATALOG_TEMPLATE_IDS = [
  'video_minimax_h3_i2v_continuation',
  'utility_seedvr2_7b_int8_upscale_image',
  'api_google_nano_banana2_image_edit_continuation'
]

/** Stands in for what the install's template package actually serves. */
function catalogEntry(name: string, withIo: boolean) {
  return {
    name,
    sourceModule: 'default',
    io: withIo
      ? {
          inputs: [
            {
              nodeId: 1,
              nodeType: 'LoadImage',
              file: 'starter.png',
              mediaType: 'image'
            }
          ]
        }
      : undefined
  }
}

const mocks = await vi.hoisted(async () => {
  const { ref, shallowRef } = await import('vue')
  return {
    nudgeArmed: ref(false),
    nudgeOutput: shallowRef<{
      filename: string
      subfolder: string
      type: 'output'
    } | null>({
      filename: 'first-output.png',
      subfolder: 'tour',
      type: 'output'
    }),
    openDialogs: ref<string[]>([]),
    catalog: ref<string[]>([]),
    catalogHasIo: ref(true),
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
    dismissNudge: mocks.dismissNudge
  })
}))

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      getTemplateByName: (name: string) =>
        mocks.catalog.value.includes(name)
          ? catalogEntry(name, mocks.catalogHasIo.value)
          : undefined
    })
  })
)

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
    mocks.openDialogs.value = []
    mocks.catalog.value = CATALOG_TEMPLATE_IDS
    mocks.catalogHasIo.value = true
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
      suggestion_count: 3
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
      templateId: 'utility_seedvr2_7b_int8_upscale_image'
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

      expect(mocks.loadWorkflowTemplate).toHaveBeenCalledWith(
        templateId,
        'default',
        { input: FIRST_OUTPUT }
      )
      expect(mocks.trackOnboardingTour).toHaveBeenCalledWith(
        'nudge_suggestion_clicked',
        {
          tour: 'firstRun',
          suggestion_count: 3,
          suggestion: id,
          loaded: true
        }
      )
      expect(mocks.dismissNudge).toHaveBeenCalled()
    }
  )

  it('waits for the catalog rather than rewriting itself under the user', async () => {
    const catalogLoaded = createDeferred<boolean>()
    mocks.catalog.value = []
    mocks.loadTemplates.mockReturnValueOnce(catalogLoaded.promise)
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    expect(
      nudge(),
      'the fallback copy would be shown, then rewritten into the continuations'
    ).toBeNull()

    mocks.catalog.value = CATALOG_TEMPLATE_IDS
    catalogLoaded.resolve(true)
    await vi.waitFor(() => {
      expect(nudge()).not.toBeNull()
    })

    expect(suggestionButton('animate')).toBeTruthy()
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith('nudge_shown', {
      tour: 'firstRun',
      suggestion_count: 3
    })
  })

  it('freezes the fallback when the catalog resolves after the deadline', async () => {
    const catalogLoaded = createDeferred<boolean>()
    mocks.catalog.value = []
    mocks.loadTemplates.mockReturnValueOnce(catalogLoaded.promise)
    mocks.nudgeArmed.value = true
    renderNudge()

    await vi.advanceTimersByTimeAsync(CATALOG_WAIT_MS)

    expect(
      screen.getByText(
        enMessages.onboardingCoachmarks.firstRun.nudge.fallback.title
      ),
      'the way forward is what the card is for (#14144)'
    ).toBeTruthy()
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith('nudge_shown', {
      tour: 'firstRun',
      suggestion_count: 0
    })

    mocks.catalog.value = CATALOG_TEMPLATE_IDS
    catalogLoaded.resolve(true)
    await catalogLoaded.promise
    await nextTick()

    expect(
      screen.queryByRole('button', {
        name: new RegExp(SUGGESTION_TITLES.animate, 'i')
      }),
      'the catalog deadline already decided what the card showed and reported'
    ).toBeNull()
    expect(
      screen.getByText(
        enMessages.onboardingCoachmarks.firstRun.nudge.fallback.title
      )
    ).toBeTruthy()
    expect(mocks.trackOnboardingTour).toHaveBeenCalledTimes(1)
  })

  it('reports one nudge per tour, however often it comes and goes', async () => {
    await showNudge()

    mocks.openDialogs.value = ['some-dialog']
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)
    mocks.openDialogs.value = []
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    const shown = () =>
      mocks.trackOnboardingTour.mock.calls.filter(
        ([stage]) => stage === 'nudge_shown'
      )
    expect(
      shown(),
      'the funnel counts nudges, so a reappearance is not a second one'
    ).toHaveLength(1)

    mocks.nudgeArmed.value = false
    await nextTick()
    mocks.nudgeArmed.value = true
    await vi.advanceTimersByTimeAsync(APPEAR_DELAY_MS)

    expect(
      shown(),
      'a second tour ends in a second nudge, which the funnel has to see'
    ).toHaveLength(2)
  })

  it('offers only the continuations the install actually serves', async () => {
    mocks.catalog.value = ['utility_seedvr2_7b_int8_upscale_image']
    await showNudge()

    expect(suggestionButton('upscale')).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: new RegExp(SUGGESTION_TITLES.animate, 'i')
      }),
      'this build knows the id, but the pinned template package does not serve it'
    ).toBeNull()
  })

  it.for([
    { named: 'serves none of them', catalog: [] as string[] },
    {
      named: 'serves them without the metadata to seed them',
      catalog: CATALOG_TEMPLATE_IDS,
      stripIo: true
    }
  ])(
    'falls back to the template browser when the install $named',
    async ({ catalog, stripIo }) => {
      mocks.catalog.value = catalog
      mocks.catalogHasIo.value = !stripIo
      await showNudge()

      expect(
        screen.queryByRole('button', {
          name: new RegExp(SUGGESTION_TITLES.animate, 'i')
        }),
        'every action would be a dead end found by clicking it'
      ).toBeNull()
      expect(
        screen.getByText(
          enMessages.onboardingCoachmarks.firstRun.nudge.fallback.title
        ),
        'the way forward is what the card is for (#14144)'
      ).toBeTruthy()
      expect(mocks.trackOnboardingTour).toHaveBeenCalledWith('nudge_shown', {
        tour: 'firstRun',
        suggestion_count: 0
      })
    }
  )

  it('falls back to the template browser when the run made no image', async () => {
    mocks.nudgeOutput.value = null
    await showNudge()

    expect(
      screen.getByText(
        enMessages.onboardingCoachmarks.firstRun.nudge.fallback.title
      )
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: new RegExp(SUGGESTION_TITLES.animate, 'i')
      }),
      'there is nothing to seed a continuation with'
    ).toBeNull()
  })

  it('keeps the card while a continuation is loading', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mocks.loadWorkflowTemplate.mockReturnValueOnce(
      createDeferred<boolean>().promise
    )
    await showNudge()

    await user.click(suggestionButton('animate'))
    await user.keyboard('{Escape}')

    expect(
      mocks.dismissNudge,
      'the graph is about to be replaced, so there is nothing to dismiss out of'
    ).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: enMessages.g.close })
    ).toBeDisabled()
  })

  it('exposes the pending continuation and blocks competing actions', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const workflowLoaded = createDeferred<boolean>()
    mocks.loadWorkflowTemplate.mockReturnValueOnce(workflowLoaded.promise)
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

    workflowLoaded.resolve(true)
    await vi.waitFor(() => {
      expect(mocks.dismissNudge).toHaveBeenCalled()
    })
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
    expect(mocks.trackOnboardingTour).toHaveBeenCalledWith(
      'nudge_suggestion_clicked',
      {
        tour: 'firstRun',
        suggestion_count: 3,
        suggestion: 'animate',
        loaded: false
      }
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
      { tour: 'firstRun', suggestion_count: 3 }
    )
    expect(mocks.dismissNudge).toHaveBeenCalled()
  })
})
