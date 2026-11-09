import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import { i18n } from '@/i18n'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useAccountUI } from '@/platform/account/composables/useAccountUI'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import { seedWorkspaces } from './agentWorkspaceTestSetup'
import { useAgentAccount } from './useAgentAccount'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/platform/account/composables/useAccountUI'))

function subscription(
  duration: SubscriptionInfo['duration']
): SubscriptionInfo {
  return {
    isActive: true,
    tier: null,
    duration,
    planSlug: null,
    scheduledChange: null,
    renewalDate: null,
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    agentHasFunds: true
  }
}

function mountAccount(): ReturnType<typeof useAgentAccount> {
  let account!: ReturnType<typeof useAgentAccount>
  render(
    {
      setup() {
        account = useAgentAccount()
        return () => null
      }
    },
    { global: { plugins: [i18n] } }
  )
  return account
}

describe('useAgentAccount', () => {
  it.for([
    { displayName: 'Marwan Mostafa', expected: 'Marwan' },
    { displayName: '  Ada  ', expected: 'Ada' },
    { displayName: '   ', expected: undefined },
    { displayName: undefined, expected: undefined }
  ])(
    'takes the first name from "$displayName"',
    ({ displayName, expected }) => {
      useCurrentUser().userDisplayName = computed(() => displayName)

      expect(mountAccount().firstName.value).toBe(expected)
    }
  )

  it.for([
    { displayName: 'Marwan Mostafa', email: 'liz@example.com', expected: 'MM' },
    { displayName: undefined, email: 'liz@example.com', expected: 'LI' },
    { displayName: undefined, email: undefined, expected: undefined }
  ])(
    'derives the initials "$expected" from the name, then the email',
    ({ displayName, email, expected }) => {
      useCurrentUser().userDisplayName = computed(() => displayName)
      useCurrentUser().userEmail = computed(() => email)

      expect(mountAccount().initials.value).toBe(expected)
    }
  )

  it.for([
    { tier: 'PRO', duration: 'MONTHLY', expected: 'Pro' },
    { tier: 'PRO', duration: 'ANNUAL', expected: 'Pro Yearly' },
    { tier: 'FREE', duration: null, expected: 'Free' },
    { tier: null, duration: null, expected: undefined }
  ] as const)(
    'labels the $tier tier billed $duration as "$expected"',
    ({ tier, duration, expected }) => {
      const billing = mockBillingContext()
      billing.tier = computed(() => tier)
      billing.subscription = computed(() => subscription(duration))

      expect(mountAccount().planLabel.value).toBe(expected)
    }
  )

  it.for([
    { balance: null, expected: undefined },
    { balance: { amountMicros: 100, currency: 'USD' }, expected: '211' },
    {
      balance: {
        amountMicros: 100,
        effectiveBalanceMicros: 100_000,
        currency: 'USD'
      },
      expected: '211,000'
    }
  ])('formats the credit balance as "$expected"', ({ balance, expected }) => {
    const billing = mockBillingContext()
    billing.balance = computed(() => balance)

    expect(mountAccount().creditBalance.value).toBe(expected)
  })

  it.for([
    { canOpenPricingSurface: true, expected: true },
    { canOpenPricingSurface: false, expected: false }
  ])(
    'offers the plans only when the pricing surface is $canOpenPricingSurface',
    ({ canOpenPricingSurface, expected }) => {
      useAccountUI().canOpenPricingSurface = computed(
        () => canOpenPricingSurface
      )

      expect(mountAccount().canViewPlans.value).toBe(expected)
    }
  )

  it.for([
    { scenario: 'once the workspaces load', expected: 'ws-personal' },
    {
      scenario: 'before the workspaces load',
      initState: 'loading',
      expected: undefined
    },
    {
      scenario: 'when the workspaces failed to load',
      initState: 'error',
      expected: undefined
    },
    {
      scenario: 'on an API key session',
      isApiKeyLogin: true,
      expected: undefined
    },
    {
      scenario: 'when no workspace is active',
      activeWorkspaceId: null,
      expected: undefined
    }
  ] as const)(
    'resolves the active workspace to $expected $scenario',
    ({
      initState = 'ready' as const,
      isApiKeyLogin = false,
      activeWorkspaceId = 'ws-personal',
      expected
    }) => {
      useCurrentUser().isApiKeyLogin = computed(() => isApiKeyLogin)
      seedWorkspaces({ initState, activeWorkspaceId })

      expect(mountAccount().activeWorkspace.value?.id).toBe(expected)
    }
  )

  it('refreshes the balance for a signed-in user', () => {
    const billing = mockBillingContext()
    useCurrentUser().isLoggedIn = computed(() => true)

    mountAccount().refreshBalance()

    expect(billing.fetchBalance).toHaveBeenCalledOnce()
  })

  it('leaves the balance alone when signed out', () => {
    const billing = mockBillingContext()

    mountAccount().refreshBalance()

    expect(billing.fetchBalance).not.toHaveBeenCalled()
  })

  it('reports a failed balance refresh instead of throwing', async () => {
    const billing = mockBillingContext()
    const failure = new Error('balance unavailable')
    vi.mocked(billing.fetchBalance).mockRejectedValue(failure)
    useCurrentUser().isLoggedIn = computed(() => true)

    mountAccount().refreshBalance()

    await vi.waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(failure, {
        surface: 'agent',
        errorType: 'error_refreshing_agent_account_balance'
      })
    })
  })
})
