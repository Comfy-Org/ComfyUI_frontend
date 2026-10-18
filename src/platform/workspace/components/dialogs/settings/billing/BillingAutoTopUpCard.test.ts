import type { AutoTopUpSetup } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

import BillingAutoTopUpCard from './BillingAutoTopUpCard.vue'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}`
}))

const configured: AutoReloadSettings = {
  configured: true,
  cycle_resets_at: '2026-11-28T00:00:00Z',
  disabled_reason: null,
  enabled: true,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 100000,
  min_reload_credits: 1000,
  monthly_budget_cents: 20000,
  paused_by_budget: false,
  paused_by_decline: false,
  reload_amount_cents: 2500,
  reload_credits: 5275,
  spent_this_cycle_cents: 5000,
  status: 'on',
  threshold_credits: 1000
}

const notConfigured: AutoReloadSettings = {
  ...configured,
  configured: false,
  enabled: false,
  monthly_budget_cents: null,
  reload_amount_cents: null,
  reload_credits: null,
  spent_this_cycle_cents: 0,
  status: 'off',
  threshold_credits: null
}

const RULE = 'Adds $25 (5,275 credits) when below 1,000 credits.'
const FAILED =
  "Your charge didn't go through. Update your payment method or add credits manually."

function renderCard(
  settings: AutoReloadSettings,
  setup: AutoTopUpSetup | null = null
) {
  vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue(settings)
  vi.mocked(useBillingCapabilities)().autoTopUpSetup = computed(() => setup)
  return render(BillingAutoTopUpCard, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
}

describe('BillingAutoTopUpCard', () => {
  it.for<{
    status: AutoReloadSettings['status']
    settings?: AutoReloadSettings
    label: string
    lines: string[]
    action: string
  }>([
    {
      status: 'failed',
      label: 'Failed',
      lines: [FAILED],
      action: 'Update payment'
    },
    {
      status: 'off',
      settings: notConfigured,
      label: 'Off',
      lines: ['Refills credits when your balance runs low'],
      action: 'Turn on'
    },
    {
      status: 'on_hold',
      label: 'On hold',
      lines: [
        RULE,
        'No default payment method. Add a card to resume auto top-up.'
      ],
      action: 'Update payment'
    },
    {
      status: 'paused_by_budget',
      label: 'Paused',
      lines: [RULE, 'Monthly limit reached. Resumes November 28.'],
      action: 'Manage'
    },
    {
      status: 'on',
      label: 'On',
      lines: [RULE, 'Monthly limit: $50 of $200 used'],
      action: 'Manage'
    }
  ])(
    'renders the served $status status',
    async ({ status, settings = configured, label, lines, action }) => {
      renderCard({ ...settings, status })

      expect(
        await screen.findByTestId('billing-auto-top-up-status')
      ).toHaveTextContent(label)
      expect(
        screen
          .getAllByTestId('billing-auto-top-up-line')
          .map((line) => line.textContent.trim())
      ).toEqual(lines)
      expect(screen.getByRole('link', { name: action })).toHaveAttribute(
        'href',
        'https://platform.test/profile/billing'
      )
    }
  )

  it('renders the served status even when the other fields disagree', async () => {
    renderCard({ ...configured, paused_by_decline: true, status: 'on' })

    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('On')
    expect(screen.queryByText(FAILED)).not.toBeInTheDocument()
  })

  it('renders an unknown served status as off', async () => {
    renderCard(fromAny({ ...notConfigured, status: 'paused_by_admin' }))

    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('Off')
  })

  it('renders nothing when the server marks setup unavailable', async () => {
    renderCard(configured, {
      state: 'unavailable',
      reason: 'billing_rail_not_supported'
    })

    await vi.waitFor(() =>
      expect(workspaceApi.getBillingAutoReload).toHaveBeenCalled()
    )
    expect(
      screen.queryByTestId('billing-auto-top-up-card')
    ).not.toBeInTheDocument()
  })

  it.for([
    { case: 'fails', error: new WorkspaceApiError('boom', 500) },
    {
      case: 'times out',
      error: new WorkspaceApiError('timeout of 10000ms exceeded', undefined)
    }
  ])('offers a retry when the settings read $case', async ({ error }) => {
    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(error)
    renderCard(configured)

    expect(
      await screen.findByText("Couldn't load auto top-up.")
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('On')
  })

  it('rereads the settings when the owner returns from the billing site', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    renderCard(notConfigured)
    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('Off')

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue(configured)
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() =>
      expect(
        screen.getByTestId('billing-auto-top-up-status')
      ).toHaveTextContent('On')
    )
    visibility.mockRestore()
  })
})
