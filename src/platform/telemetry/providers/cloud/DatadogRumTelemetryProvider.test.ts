import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const setViewName = vi.fn()

function installDatadogRum(): void {
  Object.defineProperty(window, 'DD_RUM', {
    configurable: true,
    value: { setViewName }
  })
}

afterEach(() => {
  setViewName.mockReset()
  Reflect.deleteProperty(window, 'DD_RUM')
})

describe('DatadogRumTelemetryProvider', () => {
  it.for([
    { expected: 'workspace', path: 'https://cloud.comfy.org/' },
    { expected: 'account_access', path: 'https://cloud.comfy.org/cloud/' },
    { expected: 'account_access', path: 'https://cloud.comfy.org/cloud/login' },
    {
      expected: 'account_access',
      path: 'https://cloud.comfy.org/cloud/subscribe?plan=creator'
    },
    {
      expected: 'oauth_consent',
      path: 'https://cloud.comfy.org/cloud/oauth/consent?oauth_request_id=redacted'
    },
    {
      expected: 'support_recovery',
      path: 'https://cloud.comfy.org/cloud/forgot-password'
    },
    {
      expected: 'support_recovery',
      path: 'https://cloud.comfy.org/cloud/sorry-contact-support'
    },
    {
      expected: 'support_recovery',
      path: 'https://cloud.comfy.org/cloud/auth-timeout'
    }
  ] as const)('names the current view $expected', ({ expected, path }) => {
    installDatadogRum()

    new DatadogRumTelemetryProvider().trackPageView('ignored', { path })

    expect(setViewName).toHaveBeenCalledWith(expected)
  })

  it('does nothing when Datadog RUM is unavailable', () => {
    expect(() =>
      new DatadogRumTelemetryProvider().trackPageView('ignored')
    ).not.toThrow()
  })
})
