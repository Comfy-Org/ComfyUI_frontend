import {
  BILLING_STATUS_ROUTE,
  CANCEL_SUBSCRIPTION_ROUTE,
  CAPABILITIES_ROUTE,
  CREDITS_ROUTE,
  PAYMENT_METHODS_ROUTE,
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
import { useSubscriptionCheckout } from '@/platform/workspace/composables/useSubscriptionCheckout'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'
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
  import('primevue/usetoast'), // oxlint-disable-line comfy/no-primevue-imports
  () => ({
    useToast: () => ({ add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn() })
  })
)

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
  vi.stubGlobal('fetch', server.fetchImpl)
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

function operationStages() {
  const telemetry = useTelemetry()
  assert.exists(telemetry)
  return vi
    .mocked(telemetry.trackBillingEvent)
    .mock.calls.flatMap(([event]) =>
      event.operation === 'operation' ? [event.stage] : []
    )
}

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
      terminal: 'succeeded'
    },
    {
      name: 'cancel settles failed after issue',
      routes: issuedThenSettled(
        CANCEL_SUBSCRIPTION_ROUTE,
        { status: 'pending' },
        { status: 'failed', decline_reason: 'generic' }
      ),
      drive: driveWorkspaceBilling('cancelSubscription'),
      terminal: 'failed'
    },
    {
      name: 'cancel is rejected before any operation exists',
      routes: rejected(CANCEL_SUBSCRIPTION_ROUTE),
      drive: driveWorkspaceBilling('cancelSubscription'),
      terminal: 'failed'
    },
    {
      name: 'subscribe succeeds',
      routes: issuedThenSettled(
        SUBSCRIBE_ROUTE,
        { status: 'pending_payment' },
        { status: 'succeeded' }
      ),
      drive: driveCheckoutSubscribe,
      terminal: 'succeeded'
    },
    {
      name: 'subscribe settles declined',
      routes: issuedThenSettled(
        SUBSCRIBE_ROUTE,
        { status: 'pending_payment' },
        { status: 'failed', decline_reason: 'card_declined', retryable: true }
      ),
      drive: driveCheckoutSubscribe,
      terminal: 'failed'
    },
    {
      name: 'subscribe is rejected before any operation exists',
      routes: rejected(SUBSCRIBE_ROUTE),
      drive: driveCheckoutSubscribe,
      terminal: 'failed'
    },
    {
      name: 'resubscribe succeeds',
      routes: issuedThenSettled(
        RESUBSCRIBE_ROUTE,
        { status: 'pending' },
        { status: 'succeeded' }
      ),
      drive: driveWorkspaceBilling('resubscribe'),
      terminal: 'succeeded'
    },
    {
      name: 'top-up succeeds',
      routes: issuedThenSettled(
        TOPUP_ROUTE,
        { amount_cents: 5000, status: 'pending', topup_id: 'topup-1' },
        { status: 'succeeded' }
      ),
      drive: driveTopupDialog,
      terminal: 'succeeded'
    }
  ] as const)(
    'reports one started and one terminal operation event when $name',
    async ({ routes, drive, terminal }) => {
      server.script(routes)

      await drive()

      expect(server.unanswered).toEqual([])
      expect(operationStages()).toEqual(['started', terminal])
    }
  )
})
