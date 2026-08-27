import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

const mockShowSettingsDialog = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(() => ({
    show: mockShowSettingsDialog,
    hide: vi.fn(),
    showAbout: vi.fn()
  }))
}))

const originalWindowOpen = window.open
beforeEach(() => {
  window.open = vi.fn()
})

afterAll(() => {
  window.open = originalWindowOpen
})

const mockHandleSignOut = vi.fn()
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    userPhotoUrl: 'https://example.com/avatar.jpg',
    userDisplayName: 'Test User',
    userEmail: 'test@example.com',
    handleSignOut: mockHandleSignOut
  }))
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  }))
}))

function makeSubscription(
  overrides: Partial<SubscriptionInfo> = {}
): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'CREATOR',
    duration: 'MONTHLY',
    planSlug: null,
    renewalDate: null,
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    ...overrides
  }
}

const mockFetchBalance = vi.fn().mockResolvedValue(undefined)
const mockCanAccessSubscriptionFeatures = ref(true)
const mockTier = ref<SubscriptionInfo['tier']>('CREATOR')
const mockSubscription = ref<SubscriptionInfo | null>(makeSubscription())
const mockBalance = ref<BalanceInfo | null>(null)
const mockIsLoading = ref(false)
const mockIsTeamPlan = ref(false)
const mockCanTopUp = ref(true)
const mockCanSubscribeSelfServe = ref(false)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures,
    tier: mockTier,
    subscription: mockSubscription,
    balance: mockBalance,
    isLoading: mockIsLoading,
    isTeamPlan: mockIsTeamPlan,
    fetchBalance: mockFetchBalance
  }))
}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canTopUp: mockCanTopUp,
    canSubscribeSelfServe: mockCanSubscribeSelfServe
  })
}))

vi.mock('@/components/common/UserAvatar.vue', () => ({
  default: {
    name: 'UserAvatarMock',
    render() {
      return h('div', 'Avatar')
    }
  }
}))

vi.mock('@/base/credits/comfyCredits', () => ({
  formatCreditsFromCents: vi.fn(({ cents }) => (cents / 100).toString())
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: vi.fn(() => ({
    buildDocsUrl: vi.fn((path) => `https://docs.comfy.org${path}`),
    docsPaths: {
      partnerNodesPricing: '/tutorials/partner-nodes/pricing'
    }
  }))
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackAddApiCreditButtonClicked: vi.fn()
  }))
}))

describe('CurrentUserPopoverLegacy', () => {
  beforeEach(() => {
    mockCanAccessSubscriptionFeatures.value = true
    mockTier.value = 'CREATOR'
    mockSubscription.value = makeSubscription()
    mockBalance.value = {
      amountMicros: 100_000,
      effectiveBalanceMicros: 100_000,
      currency: 'usd'
    }
    mockIsLoading.value = false
    mockCanTopUp.value = true
    mockCanSubscribeSelfServe.value = false
  })

  function renderComponent(teamWorkspaceState?: Record<string, unknown>) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(CurrentUserPopoverLegacy, {
      global: {
        plugins: [
          i18n,
          createTestingPinia({
            createSpy: vi.fn,
            initialState: teamWorkspaceState
              ? { teamWorkspace: teamWorkspaceState }
              : {}
          })
        ],
        stubs: {
          Divider: true
        }
      },
      props: {
        onClose
      }
    })

    return { user, onClose }
  }

  it('renders user information correctly', () => {
    renderComponent()

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('fetches the balance through the billing facade on mount', () => {
    renderComponent()

    expect(mockFetchBalance).toHaveBeenCalled()
  })

  describe('subscription tier badge', () => {
    it('renders the tier name derived from the facade tier', () => {
      renderComponent()

      expect(screen.getByText('Creator')).toBeInTheDocument()
    })

    it('renders the yearly tier name when the facade subscription is annual', () => {
      mockSubscription.value = makeSubscription({ duration: 'ANNUAL' })

      renderComponent()

      expect(screen.getByText('Creator Yearly')).toBeInTheDocument()
    })

    it('hides the badge when the facade reports no tier', () => {
      mockTier.value = null
      mockSubscription.value = null

      renderComponent()

      expect(screen.queryByText('Creator')).not.toBeInTheDocument()
    })
  })

  it('formats and displays the facade balance', () => {
    renderComponent()

    expect(formatCreditsFromCents).toHaveBeenCalledWith({
      cents: 100_000,
      locale: 'en',
      numberOptions: {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    })

    expect(screen.getByText('1000')).toBeInTheDocument()
  })

  it('shows a skeleton instead of the balance while billing is loading', () => {
    mockIsLoading.value = true

    renderComponent()

    expect(screen.queryByText('1000')).not.toBeInTheDocument()
  })

  it('renders logout menu item with correct text', () => {
    renderComponent()

    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()
    expect(screen.getByText('Log Out')).toBeInTheDocument()
  })

  describe('credits help icon (FE-617)', () => {
    it('renders the credits help icon as an interactive button with the unified-credits tooltip as its accessible name', () => {
      renderComponent()

      const helpButton = screen.getByTestId('credits-info-button')
      expect(helpButton).toBeInTheDocument()
      expect(helpButton.tagName).toBe('BUTTON')
      expect(helpButton).toHaveAttribute(
        'aria-label',
        enMessages.credits.unified.tooltip
      )
    })
  })

  it('opens user settings and emits close event when settings item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('user-settings-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('user-settings-menu-item'))

    expect(mockShowSettingsDialog).toHaveBeenCalledWith('user')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls logout function and emits close event when logout item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('logout-menu-item'))

    expect(mockHandleSignOut).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens API pricing docs and emits close event when partner nodes item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('partner-nodes-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('partner-nodes-menu-item'))

    expect(window.open).toHaveBeenCalledWith(
      'https://docs.comfy.org/tutorials/partner-nodes/pricing',
      '_blank'
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens top-up dialog and emits close event when top-up button is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()

    await user.click(screen.getByTestId('add-credits-button'))

    expect(mockShowTopUpCreditsDialog).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens credits settings from the legacy account menu', async () => {
    const { user, onClose } = renderComponent()

    const menuItem = screen.getByTestId('manage-plan-menu-item')
    expect(menuItem).toHaveTextContent(enMessages.credits.credits)

    await user.click(menuItem)

    expect(mockShowSettingsDialog).toHaveBeenCalledWith('credits')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('facade balance handling', () => {
    it('uses effectiveBalanceMicros when present (positive balance)', () => {
      mockBalance.value = {
        amountMicros: 200_000,
        effectiveBalanceMicros: 150_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 150_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('1500')).toBeInTheDocument()
    })

    it('uses effectiveBalanceMicros when zero', () => {
      mockBalance.value = {
        amountMicros: 100_000,
        effectiveBalanceMicros: 0,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 0,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('uses effectiveBalanceMicros when negative', () => {
      mockBalance.value = {
        amountMicros: 0,
        effectiveBalanceMicros: -50_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: -50_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('-500')).toBeInTheDocument()
    })

    it('falls back to amountMicros when effectiveBalanceMicros is missing', () => {
      mockBalance.value = {
        amountMicros: 100_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 100_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('1000')).toBeInTheDocument()
    })

    it('falls back to 0 when the facade reports no balance', () => {
      mockBalance.value = null

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 0,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })
  describe('workspace selector (non-cloud)', () => {
    const workspace = (overrides: Record<string, unknown>) => ({
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionTier: null,
      members: [],
      pendingInvites: [],
      ...overrides
    })

    const readyWorkspaceState = {
      initState: 'ready',
      activeWorkspaceId: 'ws-personal',
      isFetchingWorkspaces: false,
      workspaces: [
        workspace({
          id: 'ws-personal',
          name: 'Personal Workspace',
          type: 'personal',
          role: 'owner'
        }),
        workspace({
          id: 'ws-team',
          name: 'Team Comfy',
          type: 'team',
          role: 'member'
        })
      ]
    }

    it('stays hidden while the workspace store is not hydrated', () => {
      renderComponent()

      expect(screen.queryByTestId('workspace-switcher-trigger')).toBeNull()
    })

    it.for(['ready', 'error'])(
      'stays hidden when workspace initialization is %s without workspaces',
      (initState) => {
        renderComponent({
          initState,
          activeWorkspaceId: null,
          isFetchingWorkspaces: false,
          workspaces: []
        })

        expect(screen.queryByTestId('workspace-switcher-trigger')).toBeNull()
      }
    )

    it('shows the trigger and opens the switcher once the store is ready', async () => {
      const { user } = renderComponent(readyWorkspaceState)

      const trigger = screen.getByTestId('workspace-switcher-trigger')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
      expect(trigger).toHaveAttribute(
        'aria-controls',
        'workspace-switcher-panel'
      )
      expect(screen.queryByTestId('workspace-switcher-panel')).toBeNull()

      await user.click(trigger)

      const panel = screen.getByTestId('workspace-switcher-panel')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveAttribute('id', 'workspace-switcher-panel')
      expect(panel).toHaveAttribute('role', 'menu')
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('closes the switcher on Escape or a click elsewhere', async () => {
      const { user } = renderComponent(readyWorkspaceState)
      const trigger = screen.getByTestId('workspace-switcher-trigger')

      await user.click(trigger)
      await user.keyboard('{Escape}')
      expect(screen.queryByTestId('workspace-switcher-panel')).toBeNull()

      await user.click(trigger)
      await user.click(screen.getByText('Test User'))
      expect(screen.queryByTestId('workspace-switcher-panel')).toBeNull()
    })

    it('keeps credits visible but hides top-up for workspace members', () => {
      mockCanAccessSubscriptionFeatures.value = false
      mockCanTopUp.value = false
      renderComponent({
        ...readyWorkspaceState,
        activeWorkspaceId: 'ws-team'
      })

      expect(screen.getByTestId('manage-plan-menu-item')).toHaveTextContent(
        enMessages.credits.credits
      )
      expect(screen.queryByTestId('add-credits-button')).toBeNull()
    })
  })
})
