import {
  cloudBaseUrlFor,
  currentHostname,
  resolveBillingWebEnv,
  resolveDeployedBillingWebEnv
} from '@/config/env'
import type { BillingWebEnv } from '@/config/env'

describe('billing web environment', () => {
  it.for([
    ['production', 'https://cloud.comfy.org'],
    ['staging', 'https://stagingcloud.comfy.org'],
    ['test', 'https://testcloud.comfy.org']
  ] as const)('sends %s at %s', ([env, cloudBaseUrl]) => {
    expect(cloudBaseUrlFor(env)).toBe(cloudBaseUrl)
  })

  it.for([
    ['production', 'production'],
    ['staging', 'staging'],
    ['test', 'test'],
    ['prod', 'test'],
    ['Production', 'test'],
    ['', 'test'],
    [undefined, 'test']
  ] as [string | undefined, BillingWebEnv][])(
    'resolves %s to the %s family',
    ([value, expected]) => {
      expect(resolveBillingWebEnv(value)).toBe(expected)
    }
  )
})

describe('deployed environment resolution', () => {
  it('resolves the production host with no override to production', () => {
    expect(resolveDeployedBillingWebEnv(undefined, 'billing.comfy.org')).toBe(
      'production'
    )
  })

  it('lets an explicit override win over the production host', () => {
    expect(resolveDeployedBillingWebEnv('test', 'billing.comfy.org')).toBe(
      'test'
    )
  })

  it('lets an explicit override win over a non-production host', () => {
    expect(
      resolveDeployedBillingWebEnv('production', 'testcloud.comfy.org')
    ).toBe('production')
  })

  it('falls through an unrecognised override on a non-production host', () => {
    expect(resolveDeployedBillingWebEnv('prod', 'testcloud.comfy.org')).toBe(
      'test'
    )
  })

  it.for([
    'billing.comfy.org.evil.com',
    'evil-billing.comfy.org',
    'notbilling.comfy.org'
  ])('does not treat %s as the production host', (hostname) => {
    expect(resolveDeployedBillingWebEnv(undefined, hostname)).toBe('test')
  })

  it('resolves the default when no hostname is available', () => {
    expect(resolveDeployedBillingWebEnv(undefined, undefined)).toBe('test')
  })

  it('reads location.hostname without throwing when location is unusable', () => {
    vi.stubGlobal('location', undefined)
    expect(currentHostname()).toBeUndefined()
  })
})
