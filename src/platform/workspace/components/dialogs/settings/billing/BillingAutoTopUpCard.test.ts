import type { AutoTopUpSetup } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

import BillingAutoTopUpCard from './BillingAutoTopUpCard.vue'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, correlationId?: string) =>
    `https://platform.test${path}?correlation_id=${correlationId}`
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
  const setupRef = ref(setup)
  vi.mocked(useBillingCapabilities)().autoTopUpSetup = computed(
    () => setupRef.value
  )
  return {
    setupRef,
    ...render(BillingAutoTopUpCard, {
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
}

async function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
  await nextTick()
}

function trackedEvents() {
  return vi.mocked(useTelemetry)()?.trackBillingEvent
}

function correlationIdOf(link: HTMLElement) {
  return new URL(link.getAttribute('href') ?? '').searchParams.get(
    'correlation_id'
  )
}

async function clickWithoutNavigating(link: HTMLElement) {
  link.addEventListener('click', (event) => event.preventDefault())
  await userEvent.click(link)
}

async function returnToTab() {
  await setVisibility('hidden')
  await setVisibility('visible')
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
        'No default payment method. Set one to resume auto top-up.'
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
        expect.stringMatching(
          /^https:\/\/platform\.test\/profile\/billing\?correlation_id=.+$/
        )
      )
      expect(trackedEvents()).toHaveBeenCalledExactlyOnceWith({
        operation: 'auto_top_up_card',
        stage: 'viewed',
        outcome: 'pending',
        status
      })
    }
  )

  it.for([
    { status: 'off', action: 'Turn on', reported: 'turn_on' },
    { status: 'on', action: 'Manage', reported: 'manage' },
    { status: 'failed', action: 'Update payment', reported: 'update_payment' }
  ] as const)(
    'reports a $status card click as $reported and rotates the journey',
    async ({ status, action, reported }) => {
      renderCard({ ...configured, status })
      const link = await screen.findByRole('link', { name: action })
      const clickedId = correlationIdOf(link)

      await clickWithoutNavigating(link)

      expect(trackedEvents()).toHaveBeenCalledWith({
        operation: 'platform_handoff',
        stage: 'opened',
        outcome: 'pending',
        target: 'auto_top_up',
        action: reported,
        correlation_id: clickedId
      })
      await vi.waitFor(() => expect(correlationIdOf(link)).not.toBe(clickedId))
    }
  )

  it('reports a view only when the served status changes', async () => {
    renderCard(notConfigured)
    await screen.findByTestId('billing-auto-top-up-status')

    await returnToTab()
    await vi.waitFor(() =>
      expect(workspaceApi.getBillingAutoReload).toHaveBeenCalledTimes(2)
    )
    vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue(configured)
    await returnToTab()
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('billing-auto-top-up-status')
      ).toHaveTextContent('On')
    )

    expect(trackedEvents()).toHaveBeenCalledTimes(2)
    expect(trackedEvents()).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: 'off' })
    )
    expect(trackedEvents()).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'on' })
    )
  })

  it('reports no view while loading or when the first read fails', async () => {
    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
      new WorkspaceApiError('boom', 500)
    )
    renderCard(configured)

    expect(trackedEvents()).not.toHaveBeenCalled()
    await screen.findByText("Couldn't load auto top-up.")
    expect(trackedEvents()).not.toHaveBeenCalled()
  })

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

  it('reports no view while the server hides the card, then one once it shows', async () => {
    const { setupRef } = renderCard(configured, {
      state: 'unavailable',
      reason: 'billing_rail_not_supported'
    })
    await vi.waitFor(() =>
      expect(workspaceApi.getBillingAutoReload).toHaveBeenCalled()
    )
    expect(trackedEvents()).not.toHaveBeenCalled()

    setupRef.value = null

    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('On')
    expect(trackedEvents()).toHaveBeenCalledExactlyOnceWith({
      operation: 'auto_top_up_card',
      stage: 'viewed',
      outcome: 'pending',
      status: 'on'
    })
  })

  it('does not report the stale status when a reread failed and the card shows again', async () => {
    const { setupRef } = renderCard(configured)
    await screen.findByTestId('billing-auto-top-up-status')

    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
      new WorkspaceApiError('boom', 500)
    )
    await returnToTab()
    await screen.findByText("Couldn't load auto top-up.")
    setupRef.value = {
      state: 'unavailable',
      reason: 'billing_rail_not_supported'
    }
    await nextTick()
    setupRef.value = null
    await nextTick()

    expect(trackedEvents()).toHaveBeenCalledOnce()
  })

  it.for([
    { reread: 'the same status', settings: configured, label: 'On', views: 1 },
    {
      reread: 'a different status',
      settings: { ...configured, status: 'paused_by_budget' as const },
      label: 'Paused',
      views: 2
    }
  ])(
    'waits for a pending reread to settle, then reports $views view for $reread',
    async ({ settings, label, views }) => {
      const { setupRef } = renderCard(configured)
      await screen.findByTestId('billing-auto-top-up-status')
      vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
        new WorkspaceApiError('boom', 500)
      )
      await returnToTab()
      await screen.findByText("Couldn't load auto top-up.")
      let settleReread: (value: AutoReloadSettings) => void = () => {}
      vi.mocked(workspaceApi.getBillingAutoReload).mockReturnValueOnce(
        new Promise((resolve) => {
          settleReread = resolve
        })
      )
      await returnToTab()

      setupRef.value = {
        state: 'unavailable',
        reason: 'billing_rail_not_supported'
      }
      await nextTick()
      setupRef.value = null
      await nextTick()
      expect(trackedEvents()).toHaveBeenCalledOnce()

      settleReread(settings)
      await vi.waitFor(() =>
        expect(
          screen.getByTestId('billing-auto-top-up-status')
        ).toHaveTextContent(label)
      )

      expect(trackedEvents()).toHaveBeenCalledTimes(views)
    }
  )

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
    renderCard(notConfigured)
    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('Off')

    vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue(configured)
    await returnToTab()

    await vi.waitFor(() =>
      expect(
        screen.getByTestId('billing-auto-top-up-status')
      ).toHaveTextContent('On')
    )
  })

  it('offers a retry instead of the old status when a reread fails', async () => {
    renderCard(configured)
    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('On')

    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
      new WorkspaceApiError('boom', 500)
    )
    await returnToTab()

    expect(
      await screen.findByText("Couldn't load auto top-up.")
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('billing-auto-top-up-status')
    ).not.toBeInTheDocument()
  })

  it('keeps the newest settings when an older reread fails after it', async () => {
    renderCard(notConfigured)
    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('Off')

    let rejectOlderRead: (error: unknown) => void = () => {}
    const olderRead = new Promise<AutoReloadSettings>((_, reject) => {
      rejectOlderRead = reject
    })
    vi.mocked(workspaceApi.getBillingAutoReload)
      .mockReturnValueOnce(olderRead)
      .mockResolvedValueOnce(configured)
    await returnToTab()
    await returnToTab()
    await vi.waitFor(() =>
      expect(
        screen.getByTestId('billing-auto-top-up-status')
      ).toHaveTextContent('On')
    )

    rejectOlderRead(new WorkspaceApiError('boom', 500))
    await vi.waitFor(() => expect(reportError).toHaveBeenCalled())

    expect(screen.getByTestId('billing-auto-top-up-status')).toHaveTextContent(
      'On'
    )
  })
})
