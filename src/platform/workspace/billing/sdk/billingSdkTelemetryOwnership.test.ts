import {
  BILLING_STATUS_ROUTE,
  CANCEL_SUBSCRIPTION_ROUTE,
  CAPABILITIES_ROUTE,
  CREDITS_ROUTE,
  PAYMENT_METHODS_ROUTE,
  PREVIEW_SUBSCRIBE_ROUTE,
  RESUBSCRIBE_ROUTE,
  SUBSCRIBE_ROUTE,
  TOPUP_ROUTE,
  operationRoute
} from '@comfyorg/account-core/billing'
import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import type { SubscriptionInfo } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { i18n } from '@/i18n'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import type {
  Plan,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import TopUpCreditsDialogContentWorkspace from '@/platform/workspace/components/TopUpCreditsDialogContentWorkspace.vue'
import { useDowngradeToPersonal } from '@/platform/workspace/composables/useDowngradeToPersonal'
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useDialogStore } from '@/stores/dialogStore'
import {
  stubAccountIdentityPort,
  stubFirebaseAuthHarness
} from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('firebase/auth'))
vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useBillingPlans'),
  () => ({
    useBillingPlans: () => ({
      plans: { value: [] },
      currentPlanSlug: { value: null },
      error: { value: null },
      fetchPlans: vi.fn()
    })
  })
)
vi.mock<unknown>(import('@/components/ui/toast'), () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn()
  })
}))

const CREDENTIAL: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60 * 60 * 1000,
  uid: 'uid-1',
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: ['workspace:read']
}

const SNAPSHOT: SessionSnapshot<User> = {
  phase: 'authenticated',
  user: fromPartial<User>({ uid: 'uid-1' }),
  session: CREDENTIAL
}

const PERSONAL_WORKSPACE: WorkspaceWithRole = {
  id: 'ws-1',
  name: 'Personal',
  type: 'personal',
  role: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
}

const STANDARD_YEARLY: Plan = {
  slug: 'standard-yearly',
  tier: 'STANDARD',
  duration: 'ANNUAL',
  price_cents: 1600,
  credits_cents: 4200,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 1600,
    total_credits_cents: 4200
  }
}

const ACTIVE_SUBSCRIPTION: SubscriptionInfo = {
  isActive: true,
  tier: 'PRO',
  duration: 'MONTHLY',
  planSlug: 'pro-monthly',
  scheduledChange: null,
  renewalDate: null,
  endDate: null,
  isCancelled: false,
  hasFunds: true,
  agentHasFunds: true
}

const DOWNGRADE_PREVIEW = {
  allowed: true,
  transition_type: 'downgrade',
  effective_at: '2026-10-01T00:00:00.000Z',
  is_immediate: true,
  cost_today_cents: 0,
  cost_next_period_cents: 1600,
  credits_today_cents: 0,
  credits_next_period_cents: 4200,
  new_plan: {
    slug: 'standard-yearly',
    tier: 'STANDARD',
    duration: 'ANNUAL',
    price_cents: 1600,
    credits_cents: 4200,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 1600,
      total_credits_cents: 4200
    }
  }
}

const STATUS = {
  billing_rail: 'stripe',
  has_funds: true,
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null
}

const CAPABILITIES = {
  capabilities: {
    can_cancel: true,
    can_change_seats: false,
    can_downgrade_to_personal: false,
    can_invite_members: false,
    can_reactivate: true,
    can_revert_scheduled_change: false,
    can_subscribe_self_serve: true,
    can_top_up: true
  },
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
  revision: 1,
  rollout_defaults_applied: {
    can_downgrade_to_personal: false,
    can_subscribe_self_serve: false,
    can_top_up: false
  }
}

const PAYMENT_METHODS = [
  { brand: 'visa', id: 'pm_1', is_default: true, last4: '4242', type: 'card' }
]

interface ServerAnswer {
  readonly status: number
  readonly body: unknown
}

type ServerRoute = readonly ['GET' | 'POST', string, ServerAnswer]

function issuedThenSettled(
  route: string,
  issued: Record<string, unknown>,
  settled: Record<string, unknown>
): readonly ServerRoute[] {
  return [
    [
      'POST',
      route,
      { status: 200, body: { billing_op_id: 'op-1', ...issued } }
    ],
    [
      'GET',
      operationRoute('op-1'),
      {
        status: 200,
        body: { id: 'op-1', started_at: '2026-09-14T00:00:00.000Z', ...settled }
      }
    ]
  ]
}

function rejected(route: string): readonly ServerRoute[] {
  return [
    [
      'POST',
      route,
      {
        status: 402,
        body: { code: 'OUTSTANDING_INVOICE', message: 'Settle the invoice' }
      }
    ]
  ]
}

function alreadyHeld(route: string, code: string): readonly ServerRoute[] {
  return [
    ['POST', route, { status: 409, body: { code, message: 'Already there' } }]
  ]
}

function previewed(routes: readonly ServerRoute[]): readonly ServerRoute[] {
  return [
    ...routes,
    ['POST', PREVIEW_SUBSCRIBE_ROUTE, { status: 200, body: DOWNGRADE_PREVIEW }]
  ]
}

function fakeServer() {
  const answers = new Map<string, ServerAnswer>()
  const unanswered: string[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const { pathname } = new URL(String(input))
    const route = pathname.slice(pathname.indexOf('/billing/'))
    const key = `${init?.method ?? 'GET'} ${route}`
    const answer = answers.get(key)
    if (!answer) {
      unanswered.push(key)
      return new Response('', { status: 500 })
    }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }
  return {
    fetchImpl,
    unanswered,
    script(routes: readonly ServerRoute[]) {
      for (const [method, route, answer] of routes) {
        answers.set(`${method} ${route}`, answer)
      }
    }
  }
}

let server: ReturnType<typeof fakeServer>

beforeEach(() => {
  stubAccountIdentityPort()
  stubFirebaseAuthHarness()
  server = fakeServer()
  server.script([
    ['GET', BILLING_STATUS_ROUTE, { status: 200, body: STATUS }],
    [
      'GET',
      CREDITS_ROUTE,
      { status: 200, body: { amount_micros: 1_000_000, currency: 'USD' } }
    ],
    ['GET', CAPABILITIES_ROUTE, { status: 200, body: CAPABILITIES }],
    ['GET', PAYMENT_METHODS_ROUTE, { status: 200, body: PAYMENT_METHODS }]
  ])
  vi.mocked(fetch).mockImplementation(server.fetchImpl)
  const session = useWorkspaceAuthStore().getUnifiedSessionClient()
  vi.spyOn(session, 'getSnapshot').mockReturnValue(SNAPSHOT)
  vi.spyOn(session, 'ensureFresh').mockResolvedValue({
    status: 'ok',
    session: CREDENTIAL
  })
  vi.spyOn(session, 'remint').mockResolvedValue({
    status: 'ok',
    session: CREDENTIAL
  })
  vi.mocked(useFeatureFlags().flags).billingSdkSubscriptionRailEnabled = true
  vi.mocked(useFeatureFlags().flags).billingSdkTopupRailEnabled = true
  vi.mocked(useBillingContext).mockReturnValue(useBillingContext())
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspace: PERSONAL_WORKSPACE,
    activeWorkspaceId: PERSONAL_WORKSPACE.id
  })
})

function workspaceBilling() {
  const scope = effectScope()
  const billing = scope.run(() => useWorkspaceBilling())
  assert.exists(billing)
  return billing
}

function driveWorkspaceBilling(action: 'cancelSubscription' | 'resubscribe') {
  return async () => {
    await workspaceBilling()
      [action]()
      .catch(() => undefined)
  }
}

async function driveCheckoutSubscribe() {
  Object.assign(useBillingContext(), {
    subscribe: workspaceBilling().subscribe,
    plans: computed(() => [STANDARD_YEARLY])
  })
  let checkout: ReturnType<typeof useSubscriptionCheckout> | undefined
  render(
    {
      setup() {
        checkout = useSubscriptionCheckout(() => {})
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
  assert.exists(checkout)
  checkout.selectedTierKey.value = 'standard'
  await checkout.handleConfirmTransition()
}

async function driveLegacyStripeCheckoutSubscribe() {
  useTeamWorkspaceStore().setWorkspaceBillingRail('ws-1', 'legacy_stripe')
  await driveCheckoutSubscribe()
}

async function driveDowngrade() {
  const billing = workspaceBilling()
  Object.assign(useBillingContext(), {
    subscribe: billing.subscribe,
    previewSubscribe: billing.previewSubscribe,
    subscription: computed(() => ACTIVE_SUBSCRIPTION)
  })
  const { permissions } = useWorkspaceUI()
  useWorkspaceUI().permissions = computed(() => ({
    ...permissions.value,
    canDowngradeToPersonal: true
  }))
  await useDowngradeToPersonal()
    .downgradeToPersonal('standard-yearly')
    .catch(() => undefined)
}

async function driveTopupDialog() {
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
  render(TopUpCreditsDialogContentWorkspace, {
    global: {
      plugins: [i18n],
      stubs: {
        FormattedNumberStepper: {
          name: 'FormattedNumberStepper',
          props: ['modelValue'],
          template: '<div />'
        }
      }
    }
  })
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add credits' }))
  const pay = await screen.findByRole('button', { name: /^Pay / })
  await vi.waitFor(() => expect(pay).toBeEnabled())
  await user.click(pay)
  await vi.waitFor(() =>
    expect(useSettingsDialog().show).toHaveBeenCalledOnce()
  )
}

function operationEvents() {
  const telemetry = useTelemetry()
  assert.exists(telemetry)
  return vi.mocked(telemetry.trackBillingEvent).mock.calls.flatMap(([event]) =>
    event.operation === 'operation'
      ? [
          {
            stage: event.stage,
            ...(event.billing_op_id === undefined
              ? {}
              : { billing_op_id: event.billing_op_id }),
            ...('failure_category' in event
              ? { failure_category: event.failure_category }
              : {})
          }
        ]
      : []
  )
}

const STARTED = { stage: 'started' } as const
const LIFECYCLE_STARTED = { stage: 'started', billing_op_id: 'op-1' } as const
const SUCCEEDED = { stage: 'succeeded', billing_op_id: 'op-1' } as const
const DECLINED = {
  stage: 'failed',
  billing_op_id: 'op-1',
  failure_category: 'provider_decline'
} as const
const REFUSED = { stage: 'failed', failure_category: 'api_rejected' } as const

describe('billing operation telemetry ownership on the SDK rail', () => {
  it.for([
    {
      name: 'cancel succeeds',
      routes: issuedThenSettled(
        CANCEL_SUBSCRIPTION_ROUTE,
        { status: 'pending' },
        { status: 'succeeded' }
      ),
      drive: driveWorkspaceBilling('cancelSubscription'),
      expected: [STARTED, SUCCEEDED]
    },
    {
      name: 'cancel settles failed after issue',
      routes: issuedThenSettled(
        CANCEL_SUBSCRIPTION_ROUTE,
        { status: 'pending' },
        { status: 'failed', decline_reason: 'generic' }
      ),
      drive: driveWorkspaceBilling('cancelSubscription'),
      expected: [
        STARTED,
        {
          stage: 'failed',
          billing_op_id: 'op-1',
          failure_category: 'api_rejected'
        }
      ]
    },
    {
      name: 'cancel is rejected before any operation exists',
      routes: rejected(CANCEL_SUBSCRIPTION_ROUTE),
      drive: driveWorkspaceBilling('cancelSubscription'),
      expected: [STARTED, REFUSED]
    },
    {
      name: 'cancel finds the subscription already cancelled',
      routes: alreadyHeld(CANCEL_SUBSCRIPTION_ROUTE, 'ALREADY_CANCELED'),
      drive: driveWorkspaceBilling('cancelSubscription'),
      expected: [STARTED, { stage: 'succeeded' }]
    },
    {
      name: 'subscribe succeeds',
      routes: issuedThenSettled(
        SUBSCRIBE_ROUTE,
        { status: 'pending_payment' },
        { status: 'succeeded' }
      ),
      drive: driveCheckoutSubscribe,
      expected: [STARTED, SUCCEEDED]
    },
    {
      name: 'subscribe settles declined',
      routes: issuedThenSettled(
        SUBSCRIBE_ROUTE,
        { status: 'pending_payment' },
        { status: 'failed', decline_reason: 'card_declined', retryable: true }
      ),
      drive: driveCheckoutSubscribe,
      expected: [STARTED, DECLINED]
    },
    {
      name: 'subscribe is rejected before any operation exists',
      routes: rejected(SUBSCRIBE_ROUTE),
      drive: driveCheckoutSubscribe,
      expected: [STARTED, REFUSED]
    },
    {
      name: 'a checkout that reports no started subscribes',
      routes: issuedThenSettled(
        SUBSCRIBE_ROUTE,
        { status: 'pending_payment' },
        { status: 'succeeded' }
      ),
      drive: driveLegacyStripeCheckoutSubscribe,
      expected: [LIFECYCLE_STARTED, SUCCEEDED]
    },
    {
      name: 'downgrade to personal succeeds',
      routes: previewed(
        issuedThenSettled(
          SUBSCRIBE_ROUTE,
          { status: 'pending_payment' },
          { status: 'succeeded' }
        )
      ),
      drive: driveDowngrade,
      expected: [STARTED, SUCCEEDED]
    },
    {
      name: 'downgrade to personal settles declined',
      routes: previewed(
        issuedThenSettled(
          SUBSCRIBE_ROUTE,
          { status: 'pending_payment' },
          { status: 'failed', decline_reason: 'card_declined', retryable: true }
        )
      ),
      drive: driveDowngrade,
      expected: [STARTED, DECLINED]
    },
    {
      name: 'resubscribe succeeds',
      routes: issuedThenSettled(
        RESUBSCRIBE_ROUTE,
        { status: 'pending' },
        { status: 'succeeded' }
      ),
      drive: driveWorkspaceBilling('resubscribe'),
      expected: [LIFECYCLE_STARTED, SUCCEEDED]
    },
    {
      name: 'top-up succeeds',
      routes: issuedThenSettled(
        TOPUP_ROUTE,
        { amount_cents: 5000, status: 'pending', topup_id: 'topup-1' },
        { status: 'succeeded' }
      ),
      drive: driveTopupDialog,
      expected: [STARTED, SUCCEEDED]
    }
  ] as const)(
    'reports one started and one terminal operation event when $name',
    async ({ routes, drive, expected }) => {
      server.script(routes)

      await drive()

      expect(server.unanswered).toEqual([])
      expect(operationEvents()).toEqual(expected)
    }
  )
})
