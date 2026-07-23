import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { PaymentIntentSource } from '@/platform/telemetry/types'

import FreeTierDialogContent from './FreeTierDialogContent.vue'

const mockRenewalDate = vi.hoisted(() => ({ value: null as string | null }))
const mockQuota = vi.hoisted(() => ({ quotaEnabled: false, maxAvailable: 0 }))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    renewalDate: mockRenewalDate
  }))
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useFreeTierQuota',
  async () => {
    const { computed } = await import('vue')
    return {
      useFreeTierQuota: () => ({
        quotaEnabled: computed(() => mockQuota.quotaEnabled),
        maxAvailable: computed(() => mockQuota.maxAvailable)
      })
    }
  }
)

function renderComponent(props?: { reason?: PaymentIntentSource }) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(FreeTierDialogContent, {
    props,
    global: {
      plugins: [i18n]
    }
  })
}

describe('FreeTierDialogContent', () => {
  beforeEach(() => {
    mockRenewalDate.value = null
    mockQuota.quotaEnabled = false
    mockQuota.maxAvailable = 0
  })

  it('renders the next refresh line formatted from the facade renewalDate', () => {
    mockRenewalDate.value = '2026-07-15T10:00:00Z'
    renderComponent()
    expect(
      screen.getByText('Your next refresh will occur on Jul 15, 2026.')
    ).toBeInTheDocument()
  })

  it('hides the next refresh line when renewalDate is null', () => {
    mockRenewalDate.value = null
    renderComponent()
    expect(screen.queryByText(/next refresh/)).not.toBeInTheDocument()
  })

  it('keeps the generic copy for intent reasons outside the credits variants', () => {
    mockRenewalDate.value = '2026-07-15T10:00:00Z'
    renderComponent({ reason: 'subscribe_to_run' })
    expect(
      screen.getByText('Your next refresh will occur on Jul 15, 2026.')
    ).toBeInTheDocument()
  })

  it('swaps to the out-of-credits copy without the refresh line', () => {
    mockRenewalDate.value = '2026-07-15T10:00:00Z'
    renderComponent({ reason: 'out_of_credits' })
    expect(screen.queryByText(/next refresh/)).not.toBeInTheDocument()
  })

  it('shows the quota copy and no refresh line when the job quota is enabled', () => {
    mockQuota.quotaEnabled = true
    mockQuota.maxAvailable = 5
    mockRenewalDate.value = '2026-07-15T10:00:00Z'
    renderComponent()
    expect(
      screen.getByText(
        'Your free plan includes 5 runs to get started with Comfy Cloud — no card needed.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/next refresh/)).not.toBeInTheDocument()
  })
})
