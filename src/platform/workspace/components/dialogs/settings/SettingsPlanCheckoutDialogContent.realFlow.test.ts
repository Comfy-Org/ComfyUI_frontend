import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'
import type { SubscriptionCheckoutSelection } from '@/platform/workspace/composables/useSubscriptionCheckout'

import SettingsPlanCheckoutDialogContent from './SettingsPlanCheckoutDialogContent.vue'

// Drives the REAL useSubscriptionCheckout so the dialog's variant guards are
// exercised against state the composable actually produces, not state a mock
// was told to report.
const {
  mockPreviewSubscribe,
  mockSubscribe,
  mockToastAdd,
  mockSubscription,
  mockPlans
} = vi.hoisted(() => ({
  mockPreviewSubscribe: vi.fn(),
  mockSubscribe: vi.fn(),
  mockToastAdd: vi.fn(),
  mockSubscription: { value: null as unknown },
  mockPlans: { value: [] as unknown[] }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe,
    previewSubscribe: mockPreviewSubscribe,
    plans: computed(() => mockPlans.value),
    fetchPlans: vi.fn().mockResolvedValue(undefined),
    fetchStatus: vi.fn().mockResolvedValue(undefined),
    fetchBalance: vi.fn().mockResolvedValue(undefined),
    isTeamPlan: computed(() => true),
    resubscribe: vi.fn(),
    subscription: computed(() => mockSubscription.value)
  })
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({ shouldUseWorkspaceBilling: computed(() => true) })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canDowngradeToPersonal: true
    }))
  })
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canSubscribeSelfServe: computed(() => true),
    canReactivate: computed(() => true),
    canChangeSeats: computed(() => true),
    canDowngradeToPersonal: computed(() => true)
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showDowngradeToPersonalDialog: vi.fn().mockResolvedValue(null)
  })
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    resubscribe: vi.fn(),
    listSavedPaymentMethods: vi.fn().mockResolvedValue([]),
    getBillingStatus: vi.fn().mockResolvedValue({ billing_status: 'paid' }),
    getPaymentPortalUrl: vi.fn()
  },
  WorkspaceApiError: class WorkspaceApiError extends Error {}
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    startOperation: vi.fn().mockResolvedValue({ status: 'succeeded' }),
    retryPaymentAuthentication: vi.fn(),
    getOperation: vi.fn(),
    subscriptionActionOperation: undefined
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({ activeWorkspaceId: 'workspace-1' })
}))

vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBillingEvent: vi.fn(),
    trackResubscribeClicked: vi.fn(),
    trackBeginCheckout: vi.fn(),
    trackMonthlySubscriptionSucceeded: vi.fn()
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ userId: 'user-1' }),
  AuthStoreError: class AuthStoreError extends Error {}
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const TEAM_CHANGE: SubscriptionCheckoutSelection = {
  planMode: 'team',
  stop: { id: 'team_700', usd: 700, credits: 147_700, discountedUsd: 665 },
  billingCycle: 'yearly',
  planSlug: 'team_per_credit_annual',
  isChange: true
}

const stubs = {
  SubscriptionTransitionPreviewWorkspace: {
    props: ['previewData', 'teamPlan'],
    template: '<div data-testid="transition" />'
  },
  SubscriptionAddPaymentPreviewWorkspace: {
    props: ['previewData', 'teamPlan', 'tierKey'],
    template: '<div data-testid="add-payment" />'
  },
  SubscriptionSuccessWorkspace: { template: '<div data-testid="success" />' }
}

function renderDialog(initialCheckout: SubscriptionCheckoutSelection) {
  const onClose = vi.fn()
  render(SettingsPlanCheckoutDialogContent, {
    props: { onClose, initialCheckout },
    global: { plugins: [i18n], stubs }
  })
  return { onClose }
}

describe('SettingsPlanCheckoutDialogContent — real checkout flow', () => {
  beforeEach(() => {
    mockPlans.value = []
    mockSubscription.value = {
      isActive: true,
      isCancelled: false,
      planSlug: 'team_per_credit_annual'
    }
  })

  it('renders the loading state, not the transition, while a team change preview is pending', async () => {
    mockPreviewSubscribe.mockReturnValue(new Promise(() => {}))

    renderDialog(TEAM_CHANGE)
    await Promise.resolve()

    expect(screen.getByText('Loading')).toBeTruthy()
    expect(screen.queryByTestId('transition')).toBeNull()
  })

  it('renders the transition once the team change preview installs', async () => {
    mockPreviewSubscribe.mockResolvedValue({
      allowed: true,
      transition_type: 'upgrade',
      is_immediate: true,
      cost_today_cents: 105_000
    })

    renderDialog(TEAM_CHANGE)

    expect(await screen.findByTestId('transition')).toBeTruthy()
  })

  it('closes the dialog and toasts when the team change preview is refused', async () => {
    mockPreviewSubscribe.mockResolvedValue({ allowed: false, reason: 'nope' })

    const { onClose } = renderDialog(TEAM_CHANGE)

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'nope' })
    )
    expect(screen.queryByTestId('transition')).toBeNull()
    expect(mockSubscribe).not.toHaveBeenCalled()
  })
})
