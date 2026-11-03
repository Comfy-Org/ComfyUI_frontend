import type { AutoTopUpSetup } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type {
  AutoReloadSettings,
  SavedPaymentMethod
} from '@comfyorg/billing-core'
import type { BillingResult } from '@comfyorg/account-core/billing'
import { billingApi } from '@/platform/billing/api/billingApi'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { activateBillingScope } from '@/platform/billing/__tests__/activateBillingScope'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'

import BillingAutoTopUpCard from './BillingAutoTopUpCard.vue'
import BillingLocalCreditBanner from './BillingLocalCreditBanner.vue'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/usePausedBanner'))
vi.mock(import('@/platform/billing/composables/useBillingUI'))
vi.mock(import('@/platform/billing/api/billingApi'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, correlationId?: string) =>
    `https://platform.test${path}?correlation_id=${correlationId}`
}))

const configured: AutoReloadSettings = {
  card_expiry: null,
  configured: true,
  cycle_resets_at: '2026-11-28T00:00:00Z',
  declined_payment_method: null,
  disabled_reason: null,
  enabled: true,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 100000,
  max_reload_credits: 100000,
  min_reload_credits: 1000,
  monthly_budget_cents: 20000,
  monthly_budget_is_default: false,
  paused_by_budget: false,
  paused_by_budget_remainder: false,
  paused_by_decline: false,
  reload_amount_cents: 2500,
  reload_credits: 5275,
  spent_this_cycle_cents: 5000,
  status: 'on',
  target_credits: 6275,
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
  target_credits: null,
  threshold_credits: null
}

const RULE = 'Tops up to 6,275 credits when below 1,000 credits.'
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
  vi.mocked(billingApi.getBillingAutoReload).mockResolvedValue(settings)
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
    vi.mocked(billingApi.getBillingAutoReload).mockResolvedValue(configured)
    vi.mocked(usePausedBanner).mockReturnValue({
      isPaused: computed(() => false)
    })
    useBillingCapabilities().autoTopUpEnabled = autoTopUpEnabledFact(true)
    useBillingCapabilities().canManageAutoTopUp = canManageAutoTopUpFact(true)
    render(BillingLocalCreditBanner, i18nOptions())
    await vi.waitFor(() =>
      expect(billingApi.getBillingAutoReload).toHaveBeenCalledTimes(1)
    )
    await nextTick()
    expect(trackedEvents()).not.toHaveBeenCalled()

    renderCard(configured, {
      state: 'unavailable',
      reason: 'billing_rail_not_supported'
    })
    await nextTick()

    expect(screen.queryByTestId('billing-auto-top-up-card')).toBeNull()
    expect(billingApi.getBillingAutoReload).toHaveBeenCalledTimes(1)
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
      label: 'Limit reached',
      lines: [RULE, 'Monthly limit reached. Resumes November 28.'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'paused_by_budget',
      settings: { ...configured, cycle_resets_at: null },
      label: 'Limit reached',
      lines: [RULE, 'Monthly limit reached.'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'paused_by_budget',
      settings: { ...configured, paused_by_budget_remainder: true },
      label: 'Limit reached',
      lines: [
        RULE,
        'Next top-up would go over your monthly limit. Resumes November 28.'
      ],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'paused_by_budget',
      settings: {
        ...configured,
        paused_by_budget_remainder: true,
        cycle_resets_at: null
      },
      label: 'Limit reached',
      lines: [RULE, 'Next top-up would go over your monthly limit.'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'paused_by_budget',
      settings: { ...configured, monthly_budget_is_default: true },
      label: 'Maximum reached',
      lines: [RULE, 'Monthly maximum reached. Resets November 28.'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'paused_by_budget',
      settings: {
        ...configured,
        monthly_budget_is_default: true,
        paused_by_budget_remainder: true
      },
      label: 'Maximum reached',
      lines: [RULE, 'Monthly maximum reached. Resets November 28.'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'paused_by_budget',
      settings: {
        ...configured,
        monthly_budget_is_default: true,
        cycle_resets_at: null
      },
      label: 'Maximum reached',
      lines: [RULE, 'Monthly maximum reached.'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'on',
      settings: { ...configured, monthly_budget_is_default: true },
      label: 'On',
      lines: [RULE, 'Monthly limit: $50 of $200 used'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'on',
      label: 'On',
      lines: [RULE, 'Monthly limit: $50 of $200 used'],
      action: 'Manage',
      expectedIcon: 'icon-[lucide--arrow-up-right]'
    },
    {
      status: 'on',
      settings: { ...configured, target_credits: null },
      label: 'On',
      lines: ['Monthly limit: $50 of $200 used'],
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
      expect(billingApi.getBillingAutoReload).toHaveBeenCalledTimes(2)
    )
    vi.mocked(billingApi.getBillingAutoReload).mockResolvedValue(configured)
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
    vi.mocked(billingApi.getBillingAutoReload).mockRejectedValueOnce(
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

  it.for(['paused_by_admin', 'maximumReached', 'turnedOff'])(
    'renders the unknown served status %s as off',
    async (status) => {
      renderCard(
        fromAny({ ...configured, monthly_budget_is_default: true, status })
      )

      expect(
        await screen.findByTestId('billing-auto-top-up-status')
      ).toHaveTextContent(/^Off$/)
    }
  )

  it('renders nothing when the server marks setup unavailable', async () => {
    renderCard(configured, {
      state: 'unavailable',
      reason: 'billing_rail_not_supported'
    })

    await vi.waitFor(() =>
      expect(billingApi.getBillingAutoReload).toHaveBeenCalled()
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
      expect(billingApi.getBillingAutoReload).toHaveBeenCalled()
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

    vi.mocked(billingApi.getBillingAutoReload).mockRejectedValueOnce(
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
      label: 'Limit reached',
      views: 2
    }
  ])(
    'waits for a pending reread to settle, then reports $views view for $reread',
    async ({ settings, label, views }) => {
      const { setupRef } = renderCard(configured)
      await screen.findByTestId('billing-auto-top-up-status')
      let settleReread: (value: AutoReloadSettings) => void = () => {}
      vi.mocked(billingApi.getBillingAutoReload).mockReturnValueOnce(
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
    vi.mocked(billingApi.getBillingAutoReload).mockRejectedValueOnce(error)
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

    vi.mocked(billingApi.getBillingAutoReload).mockResolvedValue(configured)
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

    vi.mocked(billingApi.getBillingAutoReload).mockRejectedValueOnce(
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
    vi.mocked(billingApi.getBillingAutoReload).mockReturnValueOnce(
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
    expect(billingApi.getBillingAutoReload).toHaveBeenCalledTimes(2)
  })

  describe('when auto top-up is frozen for a missing default payment method', () => {
    const frozen: AutoTopUpSetup = {
      state: 'frozen',
      reason: 'default_payment_method_missing'
    }
    const savedCard: SavedPaymentMethod = {
      id: 'pm_1',
      type: 'card',
      is_default: false
    }
    function serveSavedMethods(
      methods: Promise<BillingResult<SavedPaymentMethod[]>>
    ) {
      activateBillingScope('actor-a', 'workspace-a')
      vi.mocked(useBillingSdkStore().readPaymentMethods).mockReturnValue(
        methods
      )
    }

    const NO_DEFAULT = {
      line: 'Auto top-up needs a default payment method. Set one to turn it on.',
      action: 'Update payment',
      icon: 'icon-[lucide--arrow-up-right]'
    }

    it.for<{
      name: string
      setup: AutoTopUpSetup | null
      methods: Promise<BillingResult<SavedPaymentMethod[]>>
      line: string
      action: string
      icon: string
      reads: number
      reports: number
    }>([
      {
        name: 'asks to add one when nothing is saved',
        setup: frozen,
        methods: Promise.resolve({ status: 'ok', value: [] }),
        line: 'Auto top-up needs a payment method. Add one to turn it on.',
        action: 'Add payment method',
        icon: 'icon-[lucide--arrow-up-right]',
        reads: 1,
        reports: 0
      },
      {
        name: 'asks to set a default when cards are saved',
        setup: frozen,
        methods: Promise.resolve({ status: 'ok', value: [savedCard] }),
        ...NO_DEFAULT,
        reads: 1,
        reports: 0
      },
      {
        name: 'asks to set a default while the saved list is loading',
        setup: frozen,
        methods: new Promise(() => {}),
        ...NO_DEFAULT,
        reads: 1,
        reports: 0
      },
      {
        name: 'asks to set a default and reports once when the saved list fails',
        setup: frozen,
        methods: Promise.resolve({ status: 'error', code: 'REQUEST_FAILED' }),
        ...NO_DEFAULT,
        reads: 1,
        reports: 1
      },
      {
        name: 'keeps the off card when not frozen',
        setup: null,
        methods: Promise.resolve({ status: 'ok', value: [] }),
        line: 'Refills credits when your balance runs low',
        action: 'Turn on',
        icon: 'icon-[lucide--external-link]',
        reads: 0,
        reports: 0
      }
    ])(
      '$name',
      async ({ setup, methods, line, action, icon, reads, reports }) => {
        serveSavedMethods(methods)
        renderCard(notConfigured, setup)

        const link = await screen.findByRole('link', { name: action })
        await vi.waitFor(() =>
          expect(
            screen
              .getAllByTestId('billing-auto-top-up-line')
              .map((node) => node.textContent.trim())
          ).toEqual([line])
        )
        expect(
          screen.getByTestId('billing-auto-top-up-status')
        ).toHaveTextContent('Off')
        expect(link).toContainHTML(icon)
        expect(useBillingSdkStore().readPaymentMethods).toHaveBeenCalledTimes(
          reads
        )
        expect(reportError).toHaveBeenCalledTimes(reports)
      }
    )

    it('reads the saved methods again for a workspace switch and ignores the late answer for the previous workspace', async () => {
      let settleWorkspaceA: (
        value: BillingResult<SavedPaymentMethod[]>
      ) => void = () => {}
      const workspaceA = new Promise<BillingResult<SavedPaymentMethod[]>>(
        (resolve) => {
          settleWorkspaceA = resolve
        }
      )
      serveSavedMethods(workspaceA)
      renderCard(notConfigured, frozen)
      await screen.findByRole('link', { name: 'Update payment' })

      vi.mocked(useBillingSdkStore().readPaymentMethods).mockReturnValue(
        Promise.resolve({ status: 'ok', value: [savedCard] })
      )
      activateBillingScope('actor-a', 'workspace-b')
      await vi.waitFor(() =>
        expect(useBillingSdkStore().readPaymentMethods).toHaveBeenCalledTimes(2)
      )
      settleWorkspaceA({ status: 'ok', value: [] })
      await workspaceA
      await nextTick()

      expect(
        await screen.findByRole('link', { name: 'Update payment' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Add payment method' })
      ).not.toBeInTheDocument()
    })

    it('shows the add copy for an empty workspace and the update copy after switching to one with a saved card', async () => {
      serveSavedMethods(Promise.resolve({ status: 'ok', value: [] }))
      renderCard(notConfigured, frozen)
      await screen.findByRole('link', { name: 'Add payment method' })

      vi.mocked(useBillingSdkStore().readPaymentMethods).mockReturnValue(
        Promise.resolve({ status: 'ok', value: [savedCard] })
      )
      activateBillingScope('actor-a', 'workspace-b')

      expect(
        await screen.findByRole('link', { name: 'Update payment' })
      ).toBeInTheDocument()
    })

    it('shows the update copy after the owner saves a card on the billing site and returns', async () => {
      serveSavedMethods(Promise.resolve({ status: 'ok', value: [] }))
      renderCard(notConfigured, frozen)
      await screen.findByRole('link', { name: 'Add payment method' })

      vi.mocked(useBillingSdkStore().readPaymentMethods).mockReturnValue(
        Promise.resolve({ status: 'ok', value: [savedCard] })
      )
      vi.mocked(billingApi.getBillingAutoReload).mockResolvedValue({
        ...notConfigured
      })
      await returnToTab()

      expect(
        await screen.findByRole('link', { name: 'Update payment' })
      ).toBeInTheDocument()
    })

    it('reads no saved methods while the card is on', async () => {
      serveSavedMethods(Promise.resolve({ status: 'ok', value: [] }))
      renderCard(configured, frozen)
      await screen.findByRole('link', { name: 'Manage' })

      expect(useBillingSdkStore().readPaymentMethods).not.toHaveBeenCalled()
    })

    it('reports a no-card click as update_payment', async () => {
      serveSavedMethods(Promise.resolve({ status: 'ok', value: [] }))
      renderCard(notConfigured, frozen)
      const link = await screen.findByRole('link', {
        name: 'Add payment method'
      })
      const clickedId = correlationIdOf(link)

      await clickWithoutNavigating(link)

      expect(trackedEvents()).toHaveBeenCalledWith({
        operation: 'platform_handoff',
        stage: 'opened',
        outcome: 'pending',
        target: 'auto_top_up',
        action: 'update_payment',
        correlation_id: clickedId
      })
    })

    it('leaves a card that is on unchanged', async () => {
      serveSavedMethods(Promise.resolve({ status: 'ok', value: [] }))
      renderCard(configured, frozen)

      expect(
        await screen.findByRole('link', { name: 'Manage' })
      ).toBeInTheDocument()
      expect(
        screen
          .getAllByTestId('billing-auto-top-up-line')
          .map((node) => node.textContent.trim())
      ).toEqual([RULE, 'Monthly limit: $50 of $200 used'])
    })
  })
})
