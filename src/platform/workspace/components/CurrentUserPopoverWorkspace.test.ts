import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CurrentUserPopoverWorkspace from './CurrentUserPopoverWorkspace.vue'

// Mock pinia - preserve actual exports to avoid missing defineStore
vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: vi.fn((store) => store)
  }
})

const mockCanAccessSubscriptionFeatures = ref(true)
const mockIsFreeTier = ref(false)
const mockSubscription = ref({ isCancelled: false })
const mockBalance = ref({ effectiveBalanceMicros: 100000 })
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures,
    isFreeTier: mockIsFreeTier,
    subscription: mockSubscription,
    balance: mockBalance,
    isLoading: ref(false),
    fetchBalance: vi.fn()
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    initState: ref('ready'),
    workspaceName: ref('Test Workspace'),
    isInPersonalWorkspace: ref(false)
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: ref({
      canTopUp: true,
      canManageSubscription: true
    })
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userDisplayName: 'Test User',
    userEmail: 'test@example.com',
    userPhotoUrl: null,
    handleSignOut: vi.fn()
  })
}))

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({
    show: vi.fn()
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: vi.fn(),
    showCreateWorkspaceDialog: vi.fn()
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      showPricingTable: vi.fn()
    })
  })
)

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: vi.fn().mockReturnValue('https://docs.example.com'),
    docsPaths: { partnerNodesPricing: '/pricing' }
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackAddApiCreditButtonClicked: vi.fn()
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/base/credits/comfyCredits', () => ({
  formatCreditsFromCents: vi.fn().mockReturnValue('$10.00')
}))

// Mock child components
vi.mock('@/components/common/UserAvatar.vue', () => ({
  default: { template: '<div data-testid="user-avatar"></div>' }
}))

vi.mock('./WorkspaceProfilePic.vue', () => ({
  default: { template: '<div data-testid="workspace-pic"></div>' }
}))

vi.mock('./WorkspaceSwitcherPopover.vue', () => ({
  default: { template: '<div data-testid="workspace-switcher"></div>' }
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    template: '<button :data-testid="$attrs[\'data-testid\']"><slot /></button>'
  }
}))

vi.mock('@/platform/cloud/subscription/components/SubscribeButton.vue', () => ({
  default: {
    template: '<button data-testid="subscribe-button">Subscribe</button>'
  }
}))

vi.mock('primevue/divider', () => ({
  default: { template: '<hr />' }
}))

vi.mock('primevue/popover', () => ({
  default: { template: '<div><slot /></div>' }
}))

vi.mock('primevue/skeleton', () => ({
  default: { template: '<div data-testid="skeleton"></div>' }
}))

describe('CurrentUserPopoverWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = true
    mockIsFreeTier.value = false
    mockSubscription.value = { isCancelled: false }
  })

  function renderComponent() {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return render(CurrentUserPopoverWorkspace, {
      global: {
        plugins: [i18n],
        directives: {
          tooltip: {}
        }
      }
    })
  }

  describe('canAccessSubscriptionFeatures', () => {
    it('shows add credits button when canAccessSubscriptionFeatures is true and not free tier', () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsFreeTier.value = false
      renderComponent()

      expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
      expect(
        screen.queryByTestId('upgrade-to-add-credits-button')
      ).not.toBeInTheDocument()
    })

    it('shows upgrade button when canAccessSubscriptionFeatures is true and is free tier', () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsFreeTier.value = true
      renderComponent()

      expect(
        screen.getByTestId('upgrade-to-add-credits-button')
      ).toBeInTheDocument()
      expect(screen.queryByTestId('add-credits-button')).not.toBeInTheDocument()
    })

    it('shows manage plan when canAccessSubscriptionFeatures is true', () => {
      mockCanAccessSubscriptionFeatures.value = true
      renderComponent()

      expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()
    })

    it('hides manage plan when canAccessSubscriptionFeatures is false', () => {
      mockCanAccessSubscriptionFeatures.value = false
      renderComponent()

      expect(
        screen.queryByTestId('manage-plan-menu-item')
      ).not.toBeInTheDocument()
    })
  })
})
