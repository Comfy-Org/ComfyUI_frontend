import type {
  BillingEnvironment,
  BillingIntent
} from '@comfyorg/billing-contract'

import { hostedBillingRoute } from './hostedBillingRoutes'

const cloudBaseUrl = vi.hoisted(() => ({
  value: 'https://testcloud.comfy.org'
}))

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyCloudBaseUrl: () => cloudBaseUrl.value
}))

const BILLING_WEB = new URL('https://billing.comfy.org')

function entryUrl(
  intent: BillingIntent,
  environment: BillingEnvironment = 'production',
  base: URL = BILLING_WEB
): string | undefined {
  const route = hostedBillingRoute('billing_web', intent, {}, base, environment)
  return route.kind === 'billing_web' ? route.url.href : undefined
}

describe('hostedBillingRoute', () => {
  beforeEach(() => {
    cloudBaseUrl.value = 'https://testcloud.comfy.org'
  })

  it.for([
    ['pricing', 'https://billing.comfy.org/v1/pricing'],
    ['subscription', 'https://billing.comfy.org/v1/subscription'],
    ['payment-methods', 'https://billing.comfy.org/v1/payment-methods'],
    ['checkout', 'https://billing.comfy.org/v1/checkout']
  ] as const)('mints %s at its contract route', ([intent, path]) => {
    expect(entryUrl(intent)).toBe(
      `${path}?product=comfyui&return_to=comfyui_workspace`
    )
  })

  it.for(['production', 'staging', 'test'] as const)(
    'mints the same workspace return in %s',
    (environment) => {
      expect(entryUrl('payment-methods', environment)).toContain(
        'return_to=comfyui_workspace'
      )
    }
  )

  it.for([
    ['https://billing.comfy.org/billing/', '/billing/v1/pricing'],
    ['https://billing.comfy.org/app', '/app/v1/pricing'],
    ['https://billing.comfy.org/', '/v1/pricing']
  ] as const)('serves %s beneath its own path prefix', ([base, path]) => {
    expect(entryUrl('pricing', 'production', new URL(base))).toBe(
      `https://billing.comfy.org${path}?product=comfyui&return_to=comfyui_workspace`
    )
  })

  it.for(['pricing', 'subscription', 'payment-methods'] as const)(
    'leaves %s on the provider while the server says stripe',
    (intent) => {
      expect(
        hostedBillingRoute('stripe', intent, {}, BILLING_WEB, 'production')
      ).toEqual({ kind: 'provider' })
    }
  )

  it('stays on the provider when no billing-web origin is configured', () => {
    expect(
      hostedBillingRoute('billing_web', 'pricing', {}, null, 'production')
    ).toEqual({ kind: 'provider' })
  })

  it('stays on the provider when the contract refuses the origin', () => {
    expect(
      hostedBillingRoute(
        'billing_web',
        'pricing',
        {},
        new URL('http://billing.example.com'),
        'production'
      )
    ).toEqual({ kind: 'provider' })
  })

  it('mints workspace and plan when both are supplied', () => {
    expect(
      hostedBillingRoute(
        'billing_web',
        'pricing',
        { plan: 'pro-monthly', workspaceId: 'ws-team' },
        BILLING_WEB,
        'production'
      )
    ).toEqual({
      kind: 'billing_web',
      url: new URL(
        'https://billing.comfy.org/v1/pricing?product=comfyui&return_to=comfyui_workspace&plan=pro-monthly&workspace=ws-team'
      )
    })
  })

  it('mints team_credit_stop_id alongside the plan', () => {
    expect(
      hostedBillingRoute(
        'billing_web',
        'checkout',
        { plan: 'team_per_credit_annual', teamCreditStopId: 'stop_700' },
        BILLING_WEB,
        'production'
      )
    ).toEqual({
      kind: 'billing_web',
      url: new URL(
        'https://billing.comfy.org/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=team_per_credit_annual&team_credit_stop_id=stop_700'
      )
    })
  })

  it.for([
    'https://cloud.comfy.org',
    'https://stagingcloud.comfy.org',
    'https://testcloud.comfy.org'
  ] as const)('mints an entry for the %s backend', (baseUrl) => {
    cloudBaseUrl.value = baseUrl
    vi.stubEnv('VITE_BILLING_WEB_URL', 'https://billing.comfy.org')

    expect(hostedBillingRoute('billing_web', 'pricing')).toEqual({
      kind: 'billing_web',
      url: new URL(
        'https://billing.comfy.org/v1/pricing?product=comfyui&return_to=comfyui_workspace'
      )
    })
  })

  it('stays on the provider when the cloud base URL will not parse', () => {
    cloudBaseUrl.value = 'not-a-url'
    vi.stubEnv('VITE_BILLING_WEB_URL', 'https://billing.comfy.org')

    expect(hostedBillingRoute('billing_web', 'pricing')).toEqual({
      kind: 'provider'
    })
  })

  it('stays on the provider for a backend outside the known families', () => {
    cloudBaseUrl.value = 'https://cloud.example.com'
    vi.stubEnv('VITE_BILLING_WEB_URL', 'https://billing.comfy.org')

    expect(hostedBillingRoute('billing_web', 'pricing')).toEqual({
      kind: 'provider'
    })
  })
})
