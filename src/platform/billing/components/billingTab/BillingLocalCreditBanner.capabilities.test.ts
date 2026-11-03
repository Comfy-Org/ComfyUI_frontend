import { createCapabilitiesReader } from '@comfyorg/account-core/billing'
import type { BillingTransport } from '@comfyorg/account-core/billing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import { useAutoTopUpBannerKind } from '@/platform/billing/composables/useAutoTopUpBannerKind'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'
import { projectBillingCapabilities } from '@/platform/billing/sdk/billingCapabilitiesView'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import BillingLocalCreditBanner from './BillingLocalCreditBanner.vue'

const wire: { body: unknown } = { body: {} }

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useAutoTopUpBannerKind'))
vi.mock(import('@/platform/billing/composables/usePlatformHandoff'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/useBillingUI'))
vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingReadRail'),
  () => ({
    useBillingReadRail: () => ({ readCapabilities: readCapabilitiesFromWire }),
    provideBillingSdkStore: () => {}
  })
)

async function readCapabilitiesFromWire() {
  const transport: BillingTransport = async () => ({
    status: 'ok',
    value: { httpStatus: 200, body: wire.body, header: () => null }
  })
  const result = await createCapabilitiesReader({
    transport,
    scopeSource: {
      getScope: () => ({
        userId: 'canonical-user-1',
        workspaceId: 'workspace-1',
        role: 'owner'
      }),
      subscribe: () => () => {}
    }
  }).read()
  return result.status === 'ok'
    ? { status: 'ok' as const, value: projectBillingCapabilities(result.value) }
    : result
}

function capabilitiesBody(deniedReasons: Record<string, string>) {
  return {
    capabilities: {
      can_cancel: false,
      can_change_seats: false,
      can_delete_workspace: false,
      can_downgrade_to_personal: false,
      can_edit_workspace: false,
      can_invite_members: false,
      can_leave_workspace: false,
      can_manage_auto_top_up: false,
      can_manage_billing: true,
      can_manage_members: false,
      can_manage_partner_node_access: false,
      can_manage_subscription: true,
      can_open_plans: false,
      can_reactivate: false,
      can_revert_scheduled_change: false,
      can_run_workflows: false,
      can_subscribe_self_serve: false,
      can_top_up: false,
      can_upgrade: false,
      can_view_pending_invites: false,
      can_view_team_usage: false
    },
    denied_reasons: deniedReasons,
    expires_at: '2099-01-01T00:00:00Z',
    resolved_for: { user_id: 'canonical-user-1', workspace_id: 'workspace-1' },
    revision: 1,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    }
  }
}

const exhaustedSubscription: SubscriptionInfo = {
  isActive: true,
  tier: 'PRO',
  duration: 'MONTHLY',
  planSlug: 'pro-monthly',
  scheduledChange: null,
  renewalDate: null,
  endDate: null,
  isCancelled: false,
  hasFunds: false,
  agentHasFunds: false
}

beforeEach(() => {
  stubFirebaseAuthHarness()
  vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
  Object.assign(useTeamWorkspaceStore(), {
    activeWorkspaceId: 'workspace-1',
    activeWorkspace: { id: 'workspace-1', role: 'owner' }
  })
  Object.assign(useAuthStore(), {
    userId: 'firebase-user-1',
    currentUser: { uid: 'firebase-user-1' }
  })
  vi.mocked(useAutoTopUpBannerKind).mockReturnValue(computed(() => null))
  vi.mocked(usePlatformHandoff).mockReturnValue({
    href: computed(() => 'https://platform.test/profile/billing'),
    track: vi.fn()
  })
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      subscription: computed(() => exhaustedSubscription),
      balance: computed(() => null),
      isTeamPlan: computed(() => true),
      nextCreditRefillAt: computed(() => null),
      billingStatus: computed(() => 'paid' as const)
    })
  )
  const workspace = useBillingUI()
  const permissions = workspace.permissions.value
  workspace.permissions = computed(() => ({
    ...permissions,
    canManageSubscription: receiveServerFact('can_manage_subscription', true)
  }))
  workspace.workspaceType = computed(() => 'team')
})

describe('BillingLocalCreditBanner from a served capabilities read', () => {
  it('shows the purchases-paused owner banner from the wire reason', async () => {
    wire.body = capabilitiesBody({ can_top_up: 'topup_purchases_paused' })
    await useBillingCapabilities().refresh()

    render(BillingLocalCreditBanner, {
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

    const banner = await screen.findByTestId('billing-local-credit-banner')
    expect(banner).toHaveTextContent(
      "Your team has used all its credits. Buying credits isn't available right now. Try again later."
    )
    expect(
      screen.queryByRole('button', { name: 'Add credits' })
    ).not.toBeInTheDocument()
  })
})
