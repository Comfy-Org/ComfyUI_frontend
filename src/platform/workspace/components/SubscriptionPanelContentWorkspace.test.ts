import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionPanelContentWorkspace from './SubscriptionPanelContentWorkspace.vue'

const fns = vi.hoisted(() => ({
  manageSubscription: vi.fn(),
  fetchStatus: vi.fn().mockResolvedValue(undefined),
  fetchBalance: vi.fn().mockResolvedValue(undefined),
  handleRefresh: vi.fn().mockResolvedValue(undefined),
  resubscribe: vi.fn().mockResolvedValue({}),
  toastAdd: vi.fn()
}))

const isSettingUp = ref(false)
const isActiveSubscription = ref(false)
const isFreeTier = ref(false)
const subscription = ref<Record<string, unknown> | null>(null)
const isWorkspaceSubscribed = ref(true)
const isInPersonalWorkspace = ref(false)
const members = ref([{ id: '1' }, { id: '2' }])
const perms = ref({ canManageSubscription: true, canTopUp: true })

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: fns.toastAdd })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    get isSettingUp() {
      return isSettingUp.value
    }
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    get isActiveSubscription() {
      return isActiveSubscription
    },
    get isFreeTier() {
      return isFreeTier
    },
    get subscription() {
      return subscription
    },
    showSubscriptionDialog: vi.fn(),
    manageSubscription: fns.manageSubscription,
    fetchStatus: fns.fetchStatus,
    fetchBalance: fns.fetchBalance,
    getMaxSeats: () => 5
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionCredits',
  () => ({
    useSubscriptionCredits: () => ({
      totalCredits: ref('100'),
      monthlyBonusCredits: ref('50'),
      prepaidCredits: ref('50'),
      isLoadingBalance: ref(false)
    })
  })
)

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionActions',
  () => ({
    useSubscriptionActions: () => ({
      handleAddApiCredits: vi.fn(),
      handleRefresh: fns.handleRefresh
    })
  })
)

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      showPricingTable: vi.fn()
    })
  })
)

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    get permissions() {
      return perms
    }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get isWorkspaceSubscribed() {
      return isWorkspaceSubscribed
    },
    get isInPersonalWorkspace() {
      return isInPersonalWorkspace
    },
    get members() {
      return members
    }
  })
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: { resubscribe: fns.resubscribe }
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showCancelSubscriptionDialog: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const ButtonStub = {
  name: 'Button',
  template:
    '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  props: ['disabled', 'loading', 'variant', 'size']
}

function renderComponent() {
  return render(SubscriptionPanelContentWorkspace, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        StatusBadge: {
          name: 'StatusBadge',
          template: '<span data-testid="status-badge"><slot /></span>',
          props: ['label', 'severity']
        },
        Skeleton: {
          name: 'Skeleton',
          template: '<div data-testid="skeleton" />',
          props: ['width', 'height']
        },
        Menu: true
      }
    }
  })
}

function setSubscribedState(overrides: Record<string, unknown> = {}) {
  isActiveSubscription.value = true
  isFreeTier.value = false
  subscription.value = {
    tier: 'STANDARD',
    duration: 'MONTHLY',
    renewalDate: '2026-06-01T00:00:00Z',
    endDate: null,
    isCancelled: false,
    ...overrides
  }
}

describe('SubscriptionPanelContentWorkspace (component smoke tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSettingUp.value = false
    isActiveSubscription.value = false
    isFreeTier.value = false
    subscription.value = null
    isWorkspaceSubscribed.value = true
    isInPersonalWorkspace.value = false
    members.value = [{ id: '1' }, { id: '2' }]
    perms.value = { canManageSubscription: true, canTopUp: true }
  })

  it('shows loading spinner when setting up', () => {
    isSettingUp.value = true
    renderComponent()
    expect(
      screen.getByText('billingOperation.subscriptionProcessing')
    ).toBeTruthy()
  })

  it('renders subscribed state with tier name and price', () => {
    setSubscribedState()
    renderComponent()
    const text = document.body.textContent ?? ''
    expect(text).toContain('$20')
  })

  it('calls handleRefresh on refresh button click', async () => {
    setSubscribedState()
    renderComponent()
    const allButtons = screen.getAllByRole('button')
    const refreshButton = allButtons.find(
      (b) => b.textContent === '' && !b.getAttribute('aria-label')
    )
    expect(refreshButton).toBeTruthy()
    await userEvent.click(refreshButton!)
    expect(fns.handleRefresh).toHaveBeenCalled()
  })

  it('calls workspaceApi.resubscribe on resubscribe click', async () => {
    setSubscribedState({ isCancelled: true, endDate: '2026-07-15T00:00:00Z' })
    renderComponent()
    const btn = screen.getByRole('button', {
      name: /subscription.resubscribe/
    })
    await userEvent.click(btn)
    expect(fns.resubscribe).toHaveBeenCalled()
  })

  it('shows view more details link for owners', () => {
    setSubscribedState()
    renderComponent()
    expect(
      screen.getByRole('link', { name: /subscription.viewMoreDetailsPlans/ })
    ).toHaveAttribute('href', 'https://www.comfy.org/cloud/pricing')
  })
})
