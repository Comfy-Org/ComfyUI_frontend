import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import FreeTierDialogContent from './FreeTierDialogContent.vue'

const mockRenewalDate = vi.hoisted(() => ({ value: null as string | null }))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    renewalDate: mockRenewalDate
  }))
}))

function renderComponent() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  return render(FreeTierDialogContent, {
    global: {
      plugins: [i18n]
    }
  })
}

describe('FreeTierDialogContent', () => {
  it('renders the next refresh line formatted from the facade renewalDate', () => {
    mockRenewalDate.value = '2026-07-15T10:00:00Z'
    renderComponent()
    expect(
      screen.getByText('Your credits refresh on Jul 15, 2026.')
    ).toBeInTheDocument()
  })

  it('hides the next refresh line when renewalDate is null', () => {
    mockRenewalDate.value = null
    renderComponent()
    expect(screen.queryByText(/credits refresh on/)).not.toBeInTheDocument()
  })
})
