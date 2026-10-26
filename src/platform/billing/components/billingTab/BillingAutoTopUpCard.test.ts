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
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { activateBillingScope } from '@/platform/billing/composables/activateBillingScope.testUtils'
import { canManageAutoTopUpFact } from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

import BillingAutoTopUpCard from './BillingAutoTopUpCard.vue'
import BillingLocalCreditBanner from './BillingLocalCreditBanner.vue'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/usePausedBanner'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
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

function i18nOptions() {
  return {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  }
}

function renderCard(
  settings: AutoReloadSettings,
  setup: AutoTopUpSetup | null = null
) {
  activateBillingScope('actor-a', 'workspace-a')
  vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue(settings)
  const setupRef = ref(setup)
  vi.mocked(useBillingCapabilities)().autoTopUpSetup = computed(
    () => setupRef.value
  )
  return {
    setupRef,
    ...render(BillingAutoTopUpCard, i18nOptions())
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
  it('reports no view while the read is shared with a banner that mounted first', async () => {
    activateBillingScope('actor-a', 'workspace-a')
    vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue(configured)
    vi.mocked(usePausedBanner).mockReturnValue({
      isPaused: computed(() => false)
    })
    vi.mocked(useFeatureFlags().flags).autoTopUpEnabled = true
    useBillingCapabilities().canManageAutoTopUp = canManageAutoTopUpFact(true)
    render(BillingLocalCreditBanner, i18nOptions())
    await vi.waitFor(() =>
      expect(workspaceApi.getBillingAutoReload).toHaveBeenCalledTimes(1)
    )
    await nextTick()
    expect(trackedEvents()).not.toHaveBeenCalled()

    renderCard(configured, {
      state: 'unavailable',
      reason: 'billing_rail_not_supported'
    })
    await nextTick()

    expect(screen.queryByTestId('billing-auto-top-up-card')).toBeNull()
    expect(workspaceApi.getBillingAutoReload).toHaveBeenCalledTimes(1)
    expect(trackedEvents()).not.toHaveBeenCalled()
  })

  it.for<{
    status: AutoReloadSettings['status']
    settings?: AutoReloadSettings
    disabledReason?: string
    label: string
    lines: string[]
    action: string
    expectedIcon: string
  }>([
    {
      status: 'failed',
      label: 'Failed',
      lines: [FAILED],
      action: 'Update payment',
      expectedIcon: 'icon-[lucide--external-link]'
    },
    {
      status: 'failed',
      disabledReason: 'consecutive_declines',
      label: 'Turned off',
      lines: [
        'Turned off after 3 declined charges. Update your payment method, then turn it back on.'
      ],
      action: 'Update payment',
      expectedIcon: 'icon-[lucide--external-link]'
    },
    {
      status: 'off',
      settings: notConfigured,
      label: 'Off',
      lines: ['Refills credits when your balance runs low'],
      action: 'Turn on',
      expectedIcon: 'icon-[lucide--external-link]'
    },
    {
      status: 'on_hold',
      label: 'On hold',
      lines: [
        RULE,
        'No default payment method. Set one to resume auto top-up.'
      ],
      action: 'Update payment',
      expectedIcon: 'icon-[lucide--external-link]'
    },
    {
      status: 'paused_by_budget',
      label: 'Paused',
      lines: [RULE, 'Monthly limit reached. Resumes November 28.'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'on',
      label: 'On',
      lines: [RULE, 'Monthly limit: $50 of $200 used'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    }
  ])(
    'renders the served $status status as $label',
    async ({
      status,
      settings = configured,
      disabledReason = null,
      label,
      lines,
      action,
      expectedIcon
    }) => {
      renderCard({ ...settings, status, disabled_reason: disabledReason })

      expect(
        await screen.findByTestId('billing-auto-top-up-status')
      ).toHaveTextContent(label)
      expect(
        screen
          .getAllByTestId('billing-auto-top-up-line')
          .map((line) => line.textContent.trim())
      ).toEqual(lines)
      const link = screen.getByRole('link', { name: action })
      expect(link).toHaveAttribute(
        'href',
        expect.stringMatching(
          /^https:\/\/platform\.test\/profile\/billing\?correlation_id=.+$/
        )
      )
      expect(link).toContainHTML(expectedIcon)
      expect(screen.getByTestId('billing-auto-top-up-card')).toContainHTML(
        'rounded-xl'
      )
      expect(screen.getByRole('heading', { name: /Auto top-up/ })).toHaveClass(
        'font-medium'
      )
      expect(screen.getByTestId('billing-auto-top-up-status')).toContainHTML(
        'size-1.75'
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

  it('keeps the last status and reports no new view when a reread fails', async () => {
    const { setupRef } = renderCard(configured)
    await screen.findByTestId('billing-auto-top-up-status')

    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
      new WorkspaceApiError('boom', 500)
    )
    await returnToTab()
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
    setupRef.value = {
      state: 'unavailable',
      reason: 'billing_rail_not_supported'
    }
    await nextTick()
    setupRef.value = null
    await nextTick()

    expect(screen.getByTestId('billing-auto-top-up-status')).toHaveTextContent(
      'On'
    )
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

  it('keeps the last settings when a reread fails', async () => {
    renderCard(configured)
    expect(
      await screen.findByTestId('billing-auto-top-up-status')
    ).toHaveTextContent('On')

    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
      new WorkspaceApiError('boom', 500)
    )
    await returnToTab()
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())

    expect(screen.getByTestId('billing-auto-top-up-status')).toHaveTextContent(
      'On'
    )
    expect(screen.queryByText("Couldn't load auto top-up.")).toBeNull()
  })

  it('starts no second read when the owner returns to the tab during a pending read', async () => {
    renderCard(notConfigured)
    await screen.findByTestId('billing-auto-top-up-status')
    let settle: (value: AutoReloadSettings) => void = () => {}
    vi.mocked(workspaceApi.getBillingAutoReload).mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve
      })
    )

    await returnToTab()
    await returnToTab()
    settle(configured)

    await vi.waitFor(() =>
      expect(
        screen.getByTestId('billing-auto-top-up-status')
      ).toHaveTextContent('On')
    )
    expect(workspaceApi.getBillingAutoReload).toHaveBeenCalledTimes(2)
  })
})
