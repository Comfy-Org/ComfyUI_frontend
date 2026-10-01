import { SessionTokenError } from '@comfyorg/account-core/sessionTokenMint'

import { useAuthStore } from '@/stores/authStore'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY } from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { webSessionResourceHeader } from '@/platform/auth/session/webSessionFetch'
import { useTelemetry } from '@/platform/telemetry'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { reportError } from '@/platform/telemetry/reportError'
import { performSubscriptionCheckout } from './subscriptionCheckoutUtil'

const {
  mockIsCloud,
  mockGetCheckoutAttribution,
  mockLoadCheckoutAttributionModule,
  mockLocalStorage
} = vi.hoisted(() => ({
  mockIsCloud: { value: true },
  mockGetCheckoutAttribution: vi.fn(() => ({
    ga_client_id: 'ga-client-id',
    ga_session_id: 'ga-session-id',
    ga_session_number: 'ga-session-number',
    im_ref: 'impact-click-123',
    utm_source: 'impact',
    utm_medium: 'affiliate',
    utm_campaign: 'spring-launch',
    gclid: 'gclid-123',
    gbraid: 'gbraid-456',
    wbraid: 'wbraid-789'
  })),
  mockLoadCheckoutAttributionModule: vi.fn(),
  mockLocalStorage: (() => {
    const store = new Map<string, string>()

    return {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key)
      }),
      clear: vi.fn(() => {
        store.clear()
      }),
      __reset: () => {
        store.clear()
      }
    }
  })()
}))

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock(import('./checkoutAttributionLoader'), () => ({
  loadCheckoutAttributionModule: mockLoadCheckoutAttributionModule
}))

global.fetch = vi.fn()

vi.mock(import('@/platform/auth/session/webSessionFetch'), { spy: true })

type Distribution = 'desktop' | 'localhost' | 'cloud'

const setDistribution = (distribution: Distribution) => {
  ;(
    globalThis as typeof globalThis & { __DISTRIBUTION__: Distribution }
  ).__DISTRIBUTION__ = distribution
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

beforeEach(() => {
  vi.mocked(webSessionResourceHeader).mockReset()
  vi.mocked(webSessionResourceHeader).mockResolvedValue(undefined)
  Object.assign(useAuthStore(), { userId: 'user-123' })
  vi.mocked(useAuthStore().getFirebaseAuthHeader).mockResolvedValue({
    Authorization: 'Bearer test-token' as const
  })
  vi.mocked(useAuthStore().fetchWithCustomerRecovery).mockImplementation(
    (input, init) => fetch(input, init)
  )
})

describe('performSubscriptionCheckout', () => {
  beforeEach(() => {
    mockLoadCheckoutAttributionModule.mockResolvedValue({
      getCheckoutAttribution: mockGetCheckoutAttribution
    })
    setDistribution('cloud')
    mockIsCloud.value = true
    Object.assign(useAuthStore(), { userId: 'user-123' })
    mockLocalStorage.__reset()
  })

  afterEach(() => {
    setDistribution('localhost')
    mockLocalStorage.__reset()
  })

  it.for([
    {
      name: 'no web session sends the Firebase header',
      session: undefined,
      authorization: 'Bearer test-token',
      firebaseCalls: 1
    },
    {
      name: 'a web session sends its own header instead',
      session: { Authorization: 'Bearer session-jwt' },
      authorization: 'Bearer session-jwt',
      firebaseCalls: 0
    }
  ])(
    'authorizes the tier checkout: $name',
    async ({ session, authorization, firebaseCalls }) => {
      vi.mocked(webSessionResourceHeader).mockResolvedValue(session)
      vi.spyOn(window, 'open').mockImplementation(() => window)
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ checkout_url: 'https://checkout.stripe.com/x' })
        )
      )

      await performSubscriptionCheckout('pro', 'monthly')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cloud-subscription-checkout/pro'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: authorization })
        })
      )
      expect(useAuthStore().getFirebaseAuthHeader).toHaveBeenCalledTimes(
        firebaseCalls
      )
    }
  )

  it('rejects with the mint failure and sends no tier checkout request', async () => {
    vi.mocked(webSessionResourceHeader).mockRejectedValue(
      new SessionTokenError({
        status: 'error',
        code: 'SESSION_REVOKED',
        retryable: false
      })
    )

    await expect(
      performSubscriptionCheckout('pro', 'monthly')
    ).rejects.toMatchObject({ failure: { code: 'SESSION_REVOKED' } })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('tracks begin_checkout with user id and tier metadata', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'yearly')

    expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledWith({
      user_id: 'user-123',
      tier: 'pro',
      cycle: 'yearly',
      checkout_type: 'new',
      checkout_attempt_id: expect.any(String),
      ga_client_id: 'ga-client-id',
      ga_session_id: 'ga-session-id',
      ga_session_number: 'ga-session-number',
      im_ref: 'impact-click-123',
      utm_source: 'impact',
      utm_medium: 'affiliate',
      utm_campaign: 'spring-launch',
      gclid: 'gclid-123',
      gbraid: 'gbraid-456',
      wbraid: 'wbraid-789'
    })
    const telemetry = useTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const beginCheckoutMetadata = vi.mocked(telemetry.trackBeginCheckout).mock
      .calls[0][0]
    const [, storedAttempt] = mockLocalStorage.setItem.mock.calls[0]
    expect(JSON.parse(storedAttempt)).toMatchObject({
      owner_id: 'user-123',
      workspace_id: null
    })
    expect(beginCheckoutMetadata.checkout_attempt_id).toBe(
      JSON.parse(storedAttempt).attempt_id
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/customers/cloud-subscription-checkout/pro-yearly'
      ),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          ga_client_id: 'ga-client-id',
          ga_session_id: 'ga-session-id',
          ga_session_number: 'ga-session-number',
          im_ref: 'impact-click-123',
          utm_source: 'impact',
          utm_medium: 'affiliate',
          utm_campaign: 'spring-launch',
          gclid: 'gclid-123',
          gbraid: 'gbraid-456',
          wbraid: 'wbraid-789'
        })
      })
    )
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })

  it('continues checkout when attribution collection fails', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)
    mockGetCheckoutAttribution.mockRejectedValueOnce(
      new Error('Attribution failed')
    )
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'monthly')

    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'billing',
      errorType: 'cloud_checkout_attribution_fallback',
      tags: {
        failure_kind: 'degraded',
        feature_area: 'billing',
        operation: 'load',
        outcome: 'degraded',
        attribution_stage: 'collect'
      },
      level: 'warning'
    })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers/cloud-subscription-checkout/pro'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({})
      })
    )
    expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledWith({
      user_id: 'user-123',
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new',
      checkout_attempt_id: expect.any(String)
    })
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })

  it('reports a failed attribution chunk load as the module_load stage', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => window)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: 'https://checkout.stripe.com/test' })
    } as Response)

    mockLoadCheckoutAttributionModule.mockRejectedValueOnce(
      new Error('Failed to fetch dynamically imported module')
    )
    await performSubscriptionCheckout('pro', 'monthly')

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'cloud_checkout_attribution_fallback',
        tags: expect.objectContaining({ attribution_stage: 'module_load' })
      })
    )

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers/cloud-subscription-checkout/pro'),
      expect.objectContaining({ body: JSON.stringify({}) })
    )
  })

  it('carries the payment intent source into begin_checkout and the pending attempt', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'monthly', {
      paymentIntentSource: 'out_of_credits'
    })

    expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent_source: 'out_of_credits' })
    )
    const telemetry = useTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const beginCheckoutMetadata = vi.mocked(telemetry.trackBeginCheckout).mock
      .calls[0][0]
    const [, storedAttempt] = mockLocalStorage.setItem.mock.calls[0]
    const pendingAttempt = JSON.parse(storedAttempt)
    expect(pendingAttempt).toMatchObject({
      payment_intent_source: 'out_of_credits'
    })
    expect(beginCheckoutMetadata.checkout_attempt_id).toBe(
      pendingAttempt.attempt_id
    )
    openSpy.mockRestore()
  })

  it('keeps the initiating scope when identity changes during checkout', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)
    const authHeader =
      createDeferred<
        Awaited<
          ReturnType<ReturnType<typeof useAuthStore>['getFirebaseAuthHeader']>
        >
      >()

    Object.assign(useAuthStore(), { userId: 'user-early' })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-early'
    })
    vi.mocked(useAuthStore().getFirebaseAuthHeader).mockImplementationOnce(
      () => authHeader.promise
    )
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    const checkoutPromise = performSubscriptionCheckout('pro', 'yearly')

    Object.assign(useAuthStore(), { userId: 'user-late' })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-late'
    })
    authHeader.resolve({ Authorization: 'Bearer test-token' as const })

    await checkoutPromise

    expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledTimes(1)
    expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-early',
        tier: 'pro',
        cycle: 'yearly',
        checkout_type: 'new',
        checkout_attempt_id: expect.any(String)
      })
    )
    const [, storedAttempt] = mockLocalStorage.setItem.mock.calls[0]
    expect(JSON.parse(storedAttempt)).toMatchObject({
      owner_id: 'user-early',
      workspace_id: 'workspace-early'
    })
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })

  it('closes a blocked checkout tab as a popup-blocked failure and keeps no attempt', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000004'
    )
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await expect(
      performSubscriptionCheckout('pro', 'monthly', {
        paymentIntentSource: 'deep_link'
      })
    ).rejects.toThrow("Couldn't open the payment page")

    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
    const storedAttempt = window.localStorage.getItem(
      PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
    )
    expect(storedAttempt).toBeNull()
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        checkout_attempt_id: '00000000-0000-4000-8000-000000000004'
      })
    )
    const telemetry = useTelemetry()
    assert.exists(telemetry)
    expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual([
      [
        {
          operation: 'subscription_checkout',
          stage: 'started',
          outcome: 'pending',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000004',
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'new',
          payment_intent_source: 'deep_link'
        }
      ],
      [
        {
          operation: 'subscription_checkout',
          stage: 'failed',
          outcome: 'failure',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000004',
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'new',
          payment_intent_source: 'deep_link',
          failure_category: 'redirect',
          error_code: 'payment_popup_blocked',
          duration_ms: expect.any(Number)
        }
      ]
    ])
  })

  it('closes an attempt with no checkout URL with one failure and surfaces the error', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000007'
    )
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({})))

    await expect(performSubscriptionCheckout('pro', 'monthly')).rejects.toThrow(
      'Failed to initiate subscription: No checkout URL returned'
    )

    const telemetry = useTelemetry()
    assert.exists(telemetry)
    expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual([
      [
        {
          operation: 'subscription_checkout',
          stage: 'started',
          outcome: 'pending',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000007',
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'new'
        }
      ],
      [
        {
          operation: 'subscription_checkout',
          stage: 'failed',
          outcome: 'failure',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000007',
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'new',
          failure_category: 'unknown',
          duration_ms: expect.any(Number)
        }
      ]
    ])
    expect(openSpy).not.toHaveBeenCalled()
    expect(
      window.localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
    ).toBeNull()
  })

  it('opens the attempt with one started event that the pending attempt shares', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000001'
    )
    vi.spyOn(window, 'open').mockImplementation(() => window)
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ checkout_url: 'https://checkout.stripe.com/x' })
      )
    )

    await performSubscriptionCheckout('pro', 'yearly', {
      paymentIntentSource: 'out_of_credits'
    })

    const telemetry = useTelemetry()
    assert.exists(telemetry)
    expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual([
      [
        {
          operation: 'subscription_checkout',
          stage: 'started',
          outcome: 'pending',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000001',
          tier: 'pro',
          cycle: 'yearly',
          checkout_type: 'new',
          payment_intent_source: 'out_of_credits'
        }
      ]
    ])
    expect(
      JSON.parse(
        window.localStorage.getItem(
          PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
        ) ?? 'null'
      )
    ).toMatchObject({
      attempt_id: '00000000-0000-4000-8000-000000000001',
      start_reported: true
    })
  })

  it('closes a rejected checkout attempt with a failure that follows its started event', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000002'
    )
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'declined for person@example.com' }),
      text: async () => ''
    } as Response)

    await expect(
      performSubscriptionCheckout('pro', 'yearly', {
        paymentIntentSource: 'deep_link'
      })
    ).rejects.toThrow()

    const telemetry = useTelemetry()
    assert.exists(telemetry)
    expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual([
      [
        {
          operation: 'subscription_checkout',
          stage: 'started',
          outcome: 'pending',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000002',
          tier: 'pro',
          cycle: 'yearly',
          checkout_type: 'new',
          payment_intent_source: 'deep_link'
        }
      ],
      [
        {
          operation: 'subscription_checkout',
          stage: 'failed',
          outcome: 'failure',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000002',
          tier: 'pro',
          cycle: 'yearly',
          checkout_type: 'new',
          payment_intent_source: 'deep_link',
          failure_category: 'api_rejected',
          duration_ms: expect.any(Number)
        }
      ]
    ])
  })
})
vi.mock(import('firebase/auth'))
