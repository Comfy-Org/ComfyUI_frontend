import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

const FEATURE_USAGE_KEY = 'Comfy.FeatureUsage'
const SURVEY_STATE_KEY = 'Comfy.SurveyState'
const FEATURE_ID = 'error-panel'
const PRESENTATION_INLINE_CTA = 'inline-cta'
const CTA_TEST_ID = 'error-panel-survey-cta'
const CTA_BUTTON_NAME = /give feedback/i
const CLOSE_BUTTON_NAME = 'Close'

const mockIsNightly = vi.hoisted(() => ({ value: true }))
const mockIsCloud = vi.hoisted(() => ({ value: false }))
const mockIsDesktop = vi.hoisted(() => ({ value: false }))
const mockSurveyConfig = vi.hoisted(() => ({
  value: {
    featureId: 'error-panel',
    typeformId: 'iFp4p4mV',
    triggerThreshold: 3,
    presentation: 'inline-cta'
  } as
    | {
        featureId: string
        typeformId: string
        triggerThreshold?: number
        presentation?: string
      }
    | undefined
}))
const mockOpen = vi.hoisted(() => vi.fn())
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

vi.mock(import('@/platform/distribution/types'), () => ({
  get isNightly() {
    return mockIsNightly.value
  },
  get isCloud() {
    return mockIsCloud.value
  },
  get isDesktop() {
    return mockIsDesktop.value
  }
}))

vi.mock<unknown>(import('./surveyRegistry'), () => ({
  getSurveyConfig: (id: string) =>
    id === FEATURE_ID ? mockSurveyConfig.value : undefined
}))

vi.mock(import('./useErrorSurveyPopoverState'), () => ({
  useErrorSurveyPopoverState: () => ({
    isPopoverOpen: ref(false),
    hasOpenedOnce: ref(false),
    open: mockOpen,
    close: vi.fn()
  })
}))

describe('ErrorPanelSurveyCta', () => {
  function setFeatureUsage(featureId: string, useCount: number) {
    const existing = JSON.parse(localStorage.getItem(FEATURE_USAGE_KEY) ?? '{}')
    existing[featureId] = {
      useCount,
      firstUsed: Date.now() - 1000,
      lastUsed: Date.now()
    }
    localStorage.setItem(FEATURE_USAGE_KEY, JSON.stringify(existing))
  }

  function readSurveyState() {
    return JSON.parse(
      localStorage.getItem(SURVEY_STATE_KEY) ??
        '{"optedOut":false,"seenSurveys":{}}'
    )
  }

  beforeEach(() => {
    vi.resetModules()

    mockIsNightly.value = true
    mockIsCloud.value = false
    mockIsDesktop.value = false
    mockSurveyConfig.value = {
      featureId: FEATURE_ID,
      typeformId: 'iFp4p4mV',
      triggerThreshold: 3,
      presentation: PRESENTATION_INLINE_CTA
    }
  })

  async function renderComponent() {
    const { default: ErrorPanelSurveyCta } =
      await import('./ErrorPanelSurveyCta.vue')
    return render(ErrorPanelSurveyCta, {
      global: { plugins: [i18n] }
    })
  }

  it('does not render CTA below threshold', async () => {
    setFeatureUsage(FEATURE_ID, 1)

    await renderComponent()
    await nextTick()

    expect(screen.queryByTestId(CTA_TEST_ID)).not.toBeInTheDocument()
  })

  it('renders CTA when eligible (threshold met, nightly localhost)', async () => {
    setFeatureUsage(FEATURE_ID, 5)

    await renderComponent()
    await nextTick()

    expect(screen.getByTestId(CTA_TEST_ID)).toBeInTheDocument()
  })

  it('does not render CTA on cloud build', async () => {
    mockIsCloud.value = true
    setFeatureUsage(FEATURE_ID, 5)

    await renderComponent()
    await nextTick()

    expect(screen.queryByTestId(CTA_TEST_ID)).not.toBeInTheDocument()
  })

  it('does not render CTA on desktop build', async () => {
    mockIsDesktop.value = true
    setFeatureUsage(FEATURE_ID, 5)

    await renderComponent()
    await nextTick()

    expect(screen.queryByTestId(CTA_TEST_ID)).not.toBeInTheDocument()
  })

  it('does not render CTA when typeformId is invalid', async () => {
    mockSurveyConfig.value = {
      featureId: FEATURE_ID,
      typeformId: 'invalid id with spaces!',
      triggerThreshold: 3,
      presentation: PRESENTATION_INLINE_CTA
    }
    setFeatureUsage(FEATURE_ID, 5)

    await renderComponent()
    await nextTick()

    expect(screen.queryByTestId(CTA_TEST_ID)).not.toBeInTheDocument()
  })

  it('invokes shared popover open() when CTA button clicked', async () => {
    setFeatureUsage(FEATURE_ID, 5)
    const user = userEvent.setup()

    await renderComponent()
    await nextTick()

    await user.click(screen.getByRole('button', { name: CTA_BUTTON_NAME }))

    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(readSurveyState().seenSurveys[FEATURE_ID]).toBeUndefined()
  })

  it('dismisses CTA and marks seen when × on CTA clicked', async () => {
    setFeatureUsage(FEATURE_ID, 5)
    const user = userEvent.setup()

    await renderComponent()
    await nextTick()

    const cta = screen.getByTestId(CTA_TEST_ID)
    const dismissButton = within(cta).getByRole('button', {
      name: CLOSE_BUTTON_NAME
    })
    await user.click(dismissButton)
    await nextTick()

    expect(screen.queryByTestId(CTA_TEST_ID)).not.toBeInTheDocument()
    expect(readSurveyState().seenSurveys[FEATURE_ID]).toBeGreaterThan(0)
  })
})
