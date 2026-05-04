import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CancelSubscriptionDialogContent from './CancelSubscriptionDialogContent.vue'

const isoFractionalSecondsPattern = /\.(\d+)(?=Z|[+-]\d{2}:?\d{2}|$)/

function withStrictMillisecondParser<T>(run: () => T): T {
  const RealDate = Date

  class StrictDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super()
        return
      }

      if (typeof value === 'string') {
        const fractionalSeconds = value.match(isoFractionalSecondsPattern)?.[1]
        if (fractionalSeconds && fractionalSeconds.length !== 3) {
          super(Number.NaN)
          return
        }
      }

      super(value as string | number)
    }
  }

  vi.stubGlobal('Date', StrictDate as DateConstructor)

  try {
    return run()
  } finally {
    vi.unstubAllGlobals()
  }
}

const mockSubscription = vi.hoisted(() => ({
  value: null as { endDate: string | null } | null
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    cancelSubscription: vi.fn(),
    fetchStatus: vi.fn(),
    subscription: mockSubscription
  }))
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: vi.fn(() => ({
    closeDialog: vi.fn()
  }))
}))

vi.mock('primevue/usetoast', () => ({
  useToast: vi.fn(() => ({
    add: vi.fn()
  }))
}))

function renderComponent(props: { cancelAt?: string } = {}) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(CancelSubscriptionDialogContent, {
    props,
    global: {
      plugins: [i18n],
      stubs: {
        Button: {
          template: '<button :disabled="disabled"><slot /></button>',
          props: ['disabled', 'variant', 'size', 'loading']
        }
      }
    }
  })
}

describe('CancelSubscriptionDialogContent', () => {
  describe('formattedEndDate fallbacks', () => {
    it('uses the localized fallback when no cancel timestamp is available', () => {
      mockSubscription.value = { endDate: null }
      renderComponent()

      expect(screen.getByText(/end of billing period/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('uses the localized fallback when the timestamp is unparseable', () => {
      mockSubscription.value = { endDate: 'not-a-real-date' }
      renderComponent({ cancelAt: 'also-not-a-date' })

      expect(screen.getByText(/end of billing period/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })
  })

  describe('strict ISO 8601 parsing on Safari/WebView-style runtimes', () => {
    it('renders cancelAt with 4-digit fractional seconds', () => {
      mockSubscription.value = null

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6513Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders cancelAt with 1-digit fractional seconds', () => {
      mockSubscription.value = null

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('renders subscription.endDate with 4-digit fractional seconds when cancelAt is absent', () => {
      mockSubscription.value = { endDate: '2026-04-18T10:04:55.6513Z' }

      withStrictMillisecondParser(() => {
        renderComponent()
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
    })

    it('prefers cancelAt prop over subscription.endDate when both are set', () => {
      mockSubscription.value = { endDate: '2030-01-01T00:00:00.000Z' }

      withStrictMillisecondParser(() => {
        renderComponent({ cancelAt: '2026-04-18T10:04:55.6513Z' })
      })

      expect(screen.getByText(/April 18, 2026/)).toBeInTheDocument()
      expect(screen.queryByText(/January 1, 2030/)).not.toBeInTheDocument()
    })
  })
})
