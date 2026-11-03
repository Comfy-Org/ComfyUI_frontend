import type { AutoTopUpSetup } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  AutoTopUpCardState,
  AutoTopUpOffView,
  BillingResult
} from '@comfyorg/account-core/billing'
import { BillingAutoTopUpCard as PackageCard } from '@comfyorg/account-ui/billing'
import type { AutoTopUpCardCopy } from '@comfyorg/account-ui/billing'
import type {
  AutoReloadSettings,
  SavedPaymentMethod
} from '@comfyorg/billing-core'
import { useTelemetry } from '@comfyorg/telemetry'

import enMessages from '@/locales/en/main.json'
import { activateBillingScope } from '@/platform/billing/__tests__/activateBillingScope'
import { billingApi } from '@/platform/billing/api/billingApi'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

import AppCard from './BillingAutoTopUpCard.vue'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
const t = i18n.global.t
const k = 'workspacePanel.billingTab.autoTopUp'

const copy: AutoTopUpCardCopy = {
  title: t(`${k}.title`),
  unavailable: t(`${k}.unavailable`),
  tryAgain: t('workspacePanel.billingTab.tryAgain'),
  status: {
    failed: t(`${k}.status.failed`),
    turnedOff: t(`${k}.status.turnedOff`),
    off: t(`${k}.status.off`),
    on: t(`${k}.status.on`),
    onHold: t(`${k}.status.onHold`),
    limitReached: t(`${k}.status.limitReached`),
    maximumReached: t(`${k}.status.maximumReached`)
  },
  actions: {
    addPaymentMethod: t(`${k}.actions.addPaymentMethod`),
    manage: t(`${k}.actions.manage`),
    turnOn: t(`${k}.actions.turnOn`),
    updatePayment: t(`${k}.actions.updatePayment`)
  },
  failed: t(`${k}.failed`),
  turnedOff: t(`${k}.turnedOff`),
  off: t(`${k}.off`),
  noPaymentMethod: t(`${k}.noPaymentMethod`),
  noDefaultPaymentMethod: t(`${k}.noDefaultPaymentMethod`),
  onHold: t(`${k}.onHold`),
  rule: (target, threshold) => t(`${k}.rule`, { target, threshold }),
  limit: (spent, limit) => t(`${k}.limit`, { spent, limit }),
  limitTooltip: (date) => t(`${k}.limitTooltip`, { date }),
  limitTooltipNoDate: t(`${k}.limitTooltipNoDate`),
  paused: (date) => t(`${k}.paused`, { date }),
  pausedNoDate: t(`${k}.pausedNoDate`),
  pausedByRemainder: (date) => t(`${k}.pausedByRemainder`, { date }),
  pausedByRemainderNoDate: t(`${k}.pausedByRemainderNoDate`),
  maximumReached: (date) => t(`${k}.maximumReached`, { date }),
  maximumReachedNoDate: t(`${k}.maximumReachedNoDate`)
}

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
  monthly_budget_cents: 20025,
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

const frozen: AutoTopUpSetup = {
  state: 'frozen',
  reason: 'default_payment_method_missing'
}
const savedCard: SavedPaymentMethod = {
  id: 'pm_1',
  type: 'card',
  is_default: false
}

interface Rendered {
  status: string | null
  lines: string[]
  tooltips: string[]
  alert: string | null
  control: { name: string; className: string; icon: string } | null
}

function controlOf(element: HTMLElement | undefined) {
  if (!element) return null
  return {
    name: element.textContent.trim(),
    className: element.className,
    icon: element.querySelector('i')?.className ?? ''
  }
}

function readCard(): Rendered {
  const lines = screen.queryAllByTestId('billing-auto-top-up-line')
  const actions = [
    ...screen.queryAllByRole('link'),
    ...screen
      .queryAllByRole('button')
      .filter((button) => !button.getAttribute('aria-label'))
  ]
  return {
    status:
      screen.queryByTestId('billing-auto-top-up-status')?.textContent.trim() ??
      null,
    lines: lines.map((line) => line.textContent.trim()),
    tooltips: lines.flatMap((line) =>
      [...line.querySelectorAll('[aria-label]')].map(
        (node) => node.getAttribute('aria-label') ?? ''
      )
    ),
    alert: screen.queryByRole('alert')?.textContent.trim() ?? null,
    control: controlOf(actions[0])
  }
}

function handoffAction() {
  const track = vi.mocked(useTelemetry)()?.trackBillingEvent
  const calls = track ? vi.mocked(track).mock.calls : []
  const handoff = calls
    .map(([event]) => event)
    .find((event) => event.operation === 'platform_handoff')
  return handoff && 'action' in handoff ? handoff.action : undefined
}

interface Case {
  case: string
  settings: Promise<AutoReloadSettings>
  setup?: AutoTopUpSetup | null
  methods?: SavedPaymentMethod[]
  state: AutoTopUpCardState
  offView?: AutoTopUpOffView
}

async function renderAppMatching(
  { settings, setup = null, methods = [] }: Case,
  expected: Rendered
) {
  activateBillingScope('actor-a', 'workspace-a')
  vi.mocked(billingApi.getBillingAutoReload).mockReturnValue(settings)
  vi.mocked(useBillingSdkStore().readPaymentMethods).mockReturnValue(
    Promise.resolve<BillingResult<SavedPaymentMethod[]>>({
      status: 'ok',
      value: methods
    })
  )
  vi.mocked(useBillingCapabilities)().autoTopUpSetup = computed(() => setup)
  const app = render(AppCard, { global: { plugins: [i18n] } })
  await vi.waitFor(() => expect(readCard()).toEqual(expected))
  return app
}

function renderPackage({ state, offView = 'off', setup = null }: Case) {
  const onAction = vi.fn()
  const onRetry = vi.fn()
  const pkg = render(PackageCard, {
    props: { state, offView, setup, copy, locale: 'en', onAction, onRetry },
    global: { plugins: [i18n] }
  })
  return { pkg, onAction, onRetry }
}

const served = (settings: AutoReloadSettings) => Promise.resolve(settings)
const loaded = (settings: AutoReloadSettings): AutoTopUpCardState => ({
  kind: 'loaded',
  settings
})
const variantOf = (
  settings: AutoReloadSettings,
  extra: Partial<Case> = {}
): Pick<Case, 'settings' | 'state'> & Partial<Case> => ({
  settings: served(settings),
  state: loaded(settings),
  ...extra
})

const LOADED_CASES: Case[] = [
  { case: 'on', ...variantOf(configured) },
  {
    case: 'on without a rule',
    ...variantOf({ ...configured, target_credits: null })
  },
  { case: 'off', ...variantOf(notConfigured) },
  { case: 'on hold', ...variantOf({ ...configured, status: 'on_hold' }) },
  {
    case: 'paused by budget',
    ...variantOf({ ...configured, status: 'paused_by_budget' })
  },
  {
    case: 'paused by the remainder without a date',
    ...variantOf({
      ...configured,
      status: 'paused_by_budget',
      paused_by_budget_remainder: true,
      cycle_resets_at: null
    })
  },
  { case: 'failed', ...variantOf({ ...configured, status: 'failed' }) },
  {
    case: 'turned off after consecutive declines',
    ...variantOf({
      ...configured,
      status: 'failed',
      disabled_reason: 'consecutive_declines'
    })
  },
  {
    case: 'maximum reached',
    ...variantOf({
      ...configured,
      status: 'paused_by_budget',
      monthly_budget_is_default: true
    })
  },
  {
    case: 'maximum reached without a date',
    ...variantOf({
      ...configured,
      status: 'paused_by_budget',
      monthly_budget_is_default: true,
      cycle_resets_at: null
    })
  },
  {
    case: 'no payment method',
    ...variantOf(notConfigured, {
      setup: frozen,
      methods: [],
      offView: 'noPaymentMethod'
    })
  },
  {
    case: 'no default payment method',
    ...variantOf(notConfigured, {
      setup: frozen,
      methods: [savedCard],
      offView: 'noDefaultPaymentMethod'
    })
  }
]

describe('account-ui BillingAutoTopUpCard parity with the app card', () => {
  it.for(LOADED_CASES)(
    'renders and emits the same for $case',
    async (testCase) => {
      const { pkg, onAction } = renderPackage(testCase)
      const packageCard = readCard()
      await userEvent.click(
        screen.getByRole('button', { name: packageCard.control?.name })
      )
      pkg.unmount()

      const app = await renderAppMatching(testCase, packageCard)
      const link = screen.getByRole('link', { name: packageCard.control?.name })
      link.addEventListener('click', (event) => event.preventDefault())
      await userEvent.click(link)
      app.unmount()

      expect(packageCard.status).not.toBeNull()
      expect(onAction).toHaveBeenCalledExactlyOnceWith(handoffAction())
    }
  )

  it('renders the same while loading', async () => {
    const testCase: Case = {
      case: 'loading',
      settings: new Promise<AutoReloadSettings>(() => {}),
      state: { kind: 'loading' }
    }
    const { pkg } = renderPackage(testCase)
    const packageCard = readCard()
    expect(screen.getByTestId('billing-auto-top-up-card')).toHaveTextContent(
      /^$/
    )
    pkg.unmount()

    await renderAppMatching(testCase, packageCard)

    expect(screen.getByTestId('billing-auto-top-up-card')).toHaveTextContent(
      /^$/
    )
  })

  it('renders the same retry when the read fails and retries on click', async () => {
    const testCase: Case = {
      case: 'unavailable',
      settings: Promise.reject(new WorkspaceApiError('boom', 500)),
      state: { kind: 'unavailable' }
    }
    testCase.settings.catch(() => {})
    const { pkg, onRetry } = renderPackage(testCase)
    const packageCard = readCard()
    await userEvent.click(screen.getByRole('button', { name: copy.tryAgain }))
    pkg.unmount()

    await renderAppMatching(testCase, packageCard)
    vi.mocked(billingApi.getBillingAutoReload).mockResolvedValue(configured)
    await userEvent.click(screen.getByRole('button', { name: copy.tryAgain }))

    expect(packageCard.alert).not.toBeNull()
    expect(onRetry).toHaveBeenCalledOnce()
    await vi.waitFor(() =>
      expect(billingApi.getBillingAutoReload).toHaveBeenCalledTimes(2)
    )
  })

  it('renders nothing for either card when the server marks setup unavailable', async () => {
    const testCase: Case = {
      case: 'setup unavailable',
      ...variantOf(configured, {
        setup: { state: 'unavailable', reason: 'billing_rail_not_supported' }
      })
    }
    const { pkg } = renderPackage(testCase)
    expect(screen.queryByTestId('billing-auto-top-up-card')).toBeNull()
    pkg.unmount()

    await renderAppMatching(testCase, readCard())
    await vi.waitFor(() =>
      expect(billingApi.getBillingAutoReload).toHaveBeenCalled()
    )

    expect(screen.queryByTestId('billing-auto-top-up-card')).toBeNull()
  })
})
