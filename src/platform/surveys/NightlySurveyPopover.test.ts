import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const FEATURE_USAGE_KEY = 'Comfy.FeatureUsage'

const mockIsNightly = vi.hoisted(() => ({ value: true }))
const mockIsCloud = vi.hoisted(() => ({ value: false }))
const mockIsDesktop = vi.hoisted(() => ({ value: false }))

vi.mock('@/platform/distribution/types', () => ({
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

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key
  }))
}))

describe('NightlySurveyPopover', () => {
  const defaultConfig = {
    featureId: 'test-feature',
    typeformId: 'abc123',
    triggerThreshold: 3,
    delayMs: 100,
    enabled: true
  }

  function setFeatureUsage(featureId: string, useCount: number) {
    const existing = JSON.parse(localStorage.getItem(FEATURE_USAGE_KEY) ?? '{}')
    existing[featureId] = {
      useCount,
      firstUsed: Date.now() - 1000,
      lastUsed: Date.now()
    }
    localStorage.setItem(FEATURE_USAGE_KEY, JSON.stringify(existing))
  }

  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))

    mockIsNightly.value = true
    mockIsCloud.value = false
    mockIsDesktop.value = false
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  async function renderComponent(
    config = defaultConfig,
    eventHandlers: Record<string, ReturnType<typeof vi.fn>> = {}
  ) {
    const { default: NightlySurveyPopover } =
      await import('./NightlySurveyPopover.vue')
    return render(NightlySurveyPopover, {
      props: {
        config,
        ...eventHandlers
      },
      global: {
        stubs: {
          Teleport: true
        }
      }
    })
  }

  describe('visibility', () => {
    it('shows popover after delay when eligible', async () => {
      setFeatureUsage('test-feature', 5)

      await renderComponent()
      await nextTick()

      expect(
        screen.queryByTestId('nightly-survey-popover')
      ).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(100)
      await nextTick()

      expect(screen.getByTestId('nightly-survey-popover')).toBeInTheDocument()
    })

    it('does not show when not eligible', async () => {
      setFeatureUsage('test-feature', 1)

      await renderComponent()
      await nextTick()
      await vi.advanceTimersByTimeAsync(1000)
      await nextTick()

      expect(
        screen.queryByTestId('nightly-survey-popover')
      ).not.toBeInTheDocument()
    })

    it('does not show on cloud', async () => {
      mockIsCloud.value = true
      setFeatureUsage('test-feature', 5)

      await renderComponent()
      await nextTick()
      await vi.advanceTimersByTimeAsync(1000)
      await nextTick()

      expect(
        screen.queryByTestId('nightly-survey-popover')
      ).not.toBeInTheDocument()
    })
  })

  describe('user actions', () => {
    it('emits shown event when displayed', async () => {
      setFeatureUsage('test-feature', 5)
      const onShown = vi.fn()

      await renderComponent(defaultConfig, { onShown })
      await vi.advanceTimersByTimeAsync(100)
      await nextTick()

      expect(onShown).toHaveBeenCalledTimes(1)
    })

    it('emits dismissed when close button clicked', async () => {
      setFeatureUsage('test-feature', 5)
      const onDismissed = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await renderComponent(defaultConfig, { onDismissed })
      await vi.advanceTimersByTimeAsync(100)
      await nextTick()

      const closeButton = screen.getByRole('button', { name: 'g.close' })
      await user.click(closeButton)

      expect(onDismissed).toHaveBeenCalledTimes(1)
    })

    it('emits optedOut when opt out button clicked', async () => {
      setFeatureUsage('test-feature', 5)
      const onOptedOut = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await renderComponent(defaultConfig, { onOptedOut })
      await vi.advanceTimersByTimeAsync(100)
      await nextTick()

      const optOutButton = screen.getByRole('button', {
        name: /nightlySurvey.dontAskAgain/
      })
      await user.click(optOutButton)

      expect(onOptedOut).toHaveBeenCalledTimes(1)
    })
  })

  describe('manual mode', () => {
    async function renderManual(open = false) {
      const { default: NightlySurveyPopover } =
        await import('./NightlySurveyPopover.vue')
      return render(NightlySurveyPopover, {
        props: {
          config: defaultConfig,
          mode: 'manual',
          open
        },
        global: {
          stubs: {
            Teleport: true
          }
        }
      })
    }

    it('does not auto-open via eligibility watcher', async () => {
      setFeatureUsage('test-feature', 5)

      await renderManual(false)
      await nextTick()
      await vi.advanceTimersByTimeAsync(1000)
      await nextTick()

      expect(
        screen.queryByTestId('nightly-survey-popover')
      ).not.toBeInTheDocument()
    })

    it('shows when parent sets open=true regardless of delay', async () => {
      await renderManual(true)
      await nextTick()

      expect(screen.getByTestId('nightly-survey-popover')).toBeInTheDocument()
    })

    it('does not render the Not Now button', async () => {
      await renderManual(true)
      await nextTick()

      expect(
        screen.queryByRole('button', { name: /nightlySurvey.notNow/ })
      ).not.toBeInTheDocument()
    })

    it('does not call markSurveyShown automatically', async () => {
      await renderManual(true)
      await nextTick()

      const state = JSON.parse(
        localStorage.getItem('Comfy.SurveyState') ??
          '{"optedOut":false,"seenSurveys":{}}'
      )
      expect(state.seenSurveys['test-feature']).toBeUndefined()
    })

    it("still persists optedOut when Don't Ask Again clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await renderManual(true)
      await nextTick()

      const optOutButton = screen.getByRole('button', {
        name: /nightlySurvey.dontAskAgain/
      })
      await user.click(optOutButton)
      await nextTick()

      const state = JSON.parse(
        localStorage.getItem('Comfy.SurveyState') ?? '{}'
      )
      expect(state.optedOut).toBe(true)
    })
  })

  describe('config', () => {
    it('uses custom delay from config', async () => {
      setFeatureUsage('test-feature', 5)

      await renderComponent({
        ...defaultConfig,
        delayMs: 500
      })
      await nextTick()

      await vi.advanceTimersByTimeAsync(400)
      await nextTick()
      expect(
        screen.queryByTestId('nightly-survey-popover')
      ).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(100)
      await nextTick()
      expect(screen.getByTestId('nightly-survey-popover')).toBeInTheDocument()
    })

    it('does not show when config is disabled', async () => {
      setFeatureUsage('test-feature', 5)

      await renderComponent({
        ...defaultConfig,
        enabled: false
      })
      await nextTick()
      await vi.advanceTimersByTimeAsync(1000)
      await nextTick()

      expect(
        screen.queryByTestId('nightly-survey-popover')
      ).not.toBeInTheDocument()
    })
  })
})
