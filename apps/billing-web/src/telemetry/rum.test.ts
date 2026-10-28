import { datadogRum } from '@datadog/browser-rum'
import { describe, expect, it, vi } from 'vitest'

import type { ScrubbableRumEvent } from '@/telemetry/rum'
import {
  billingWebRumBeforeSend,
  initBillingWebRum,
  reportBillingWebError
} from '@/telemetry/rum'

vi.mock(import('@datadog/browser-rum'))

describe('initBillingWebRum', () => {
  it.for([
    { hostname: 'billing.comfy.org', env: 'prod-v2' },
    { hostname: 'stagingbilling.comfy.org', env: 'stg-v2' },
    { hostname: 'testbilling.comfy.org', env: 'test-v2' }
  ])(
    'reports $hostname to the cloud RUM application as its own service in $env',
    ({ hostname, env }) => {
      initBillingWebRum({ hostname, version: 'commit-sha' })

      expect(datadogRum.init).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: '041a9897-5516-4b1f-a245-1a9aa6895488',
          clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
          site: 'us5.datadoghq.com',
          service: 'comfy-billing-web',
          env,
          version: 'commit-sha',
          beforeSend: billingWebRumBeforeSend
        })
      )
    }
  )

  it('adds no trace headers to the cross-origin Cloud calls', () => {
    initBillingWebRum({ hostname: 'billing.comfy.org', version: 'commit-sha' })

    expect(datadogRum.init).toHaveBeenCalledOnce()
    const config = vi.mocked(datadogRum.init).mock.lastCall?.[0]
    expect(config?.allowedTracingUrls ?? []).toEqual([])
  })

  it.for([
    'localhost',
    'billing-web-git-main-comfy.vercel.app',
    'billing.comfy.org.example.com',
    undefined
  ])('reports nothing from the unmapped host %s', (hostname) => {
    initBillingWebRum({ hostname, version: 'commit-sha' })

    expect(datadogRum.init).not.toHaveBeenCalled()
  })

  it('leaves an already running RUM session alone', () => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      clientToken: 'pub-other',
      applicationId: 'other'
    })

    initBillingWebRum({ hostname: 'billing.comfy.org', version: 'commit-sha' })

    expect(datadogRum.init).not.toHaveBeenCalled()
  })
})

describe('billingWebRumBeforeSend', () => {
  it.for<{
    name: string
    event: ScrubbableRumEvent
    expected: ScrubbableRumEvent
  }>([
    {
      name: 'a view keeps its path but not the query or fragment',
      event: {
        type: 'view',
        view: {
          url: 'https://billing.comfy.org/v1/checkout?payment_intent_client_secret=pi_1_secret_2&redirect_status=succeeded#summary',
          referrer:
            'https://cloud.comfy.org/?correlation_id=c1&email=ada@example.com'
        }
      },
      expected: {
        type: 'view',
        view: {
          url: 'https://billing.comfy.org/v1/checkout',
          referrer: 'https://cloud.comfy.org/'
        }
      }
    },
    {
      name: 'a resource keeps its path but not the query',
      event: {
        type: 'resource',
        view: { url: 'https://billing.comfy.org/v1/checkout' },
        resource: {
          url: 'https://cloud.comfy.org/api/billing/status?workspace_id=w1'
        }
      },
      expected: {
        type: 'resource',
        view: { url: 'https://billing.comfy.org/v1/checkout' },
        resource: { url: 'https://cloud.comfy.org/api/billing/status' }
      }
    },
    {
      name: 'an error loses emails, tokens, client secrets and query strings',
      event: {
        type: 'error',
        view: { url: 'https://billing.comfy.org/v1/checkout' },
        error: {
          source: 'source',
          message:
            'Card declined for ada@example.com with pi_3Ab_secret_Cd at https://cloud.comfy.org/api/billing/subscribe?promo=SPRING',
          stack:
            'Error: Bearer abc.def-ghi\n    at fetch (https://billing.comfy.org/assets/index.js?v=1:1:2) eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl',
          resource: {
            url: 'https://cloud.comfy.org/api/billing/subscribe?promo=SPRING'
          }
        }
      },
      expected: {
        type: 'error',
        view: { url: 'https://billing.comfy.org/v1/checkout' },
        error: {
          source: 'source',
          message:
            'Card declined for [email] with [token] at https://cloud.comfy.org/api/billing/subscribe',
          stack:
            'Error: Bearer [token]\n    at fetch (https://billing.comfy.org/assets/index.js) [token]',
          resource: { url: 'https://cloud.comfy.org/api/billing/subscribe' }
        }
      }
    },
    {
      name: 'a click loses the email in its element text',
      event: {
        type: 'action',
        view: { url: 'https://billing.comfy.org/v1/subscription' },
        action: { target: { name: 'Signed in as ada@example.com' } }
      },
      expected: {
        type: 'action',
        view: { url: 'https://billing.comfy.org/v1/subscription' },
        action: { target: { name: 'Signed in as [email]' } }
      }
    }
  ])('sends $name', ({ event, expected }) => {
    expect(billingWebRumBeforeSend(event)).toBe(true)
    expect(event).toEqual(expected)
  })

  it.for([
    {
      source: 'console',
      message: '[Reported error]: failure_confirming_checkout'
    },
    {
      source: 'source',
      message: 'ResizeObserver loop completed with undelivered notifications.'
    },
    { source: 'report', message: 'intervention: Slow network is detected.' },
    {
      source: 'source',
      message: 'Invalid call to runtime.sendMessage(). Tab not found.'
    },
    {
      source: 'network',
      message: 'Failed to fetch https://px.ads.linkedin.com/collect'
    }
  ])('drops the noise error "$message"', (error) => {
    const event: ScrubbableRumEvent = {
      type: 'error',
      view: { url: 'https://billing.comfy.org/v1/checkout' },
      error
    }

    expect(billingWebRumBeforeSend(event)).toBe(false)
  })

  it.for([
    { cause: 'Declined for ada@example.com', sent: false },
    {
      cause: 'Request failed at https://cloud.comfy.org/api/x?promo=SPRING',
      sent: false
    },
    { cause: 'Card declined', sent: true }
  ])(
    'sends an error whose cause reads "$cause": $sent, since RUM keeps causes as they are',
    ({ cause, sent }) => {
      const event: ScrubbableRumEvent = {
        type: 'error',
        view: { url: 'https://billing.comfy.org/v1/checkout' },
        error: {
          source: 'source',
          message: 'Checkout failed',
          causes: [{ message: cause }]
        }
      }

      expect(billingWebRumBeforeSend(event)).toBe(sent)
    }
  )
})

describe('reportBillingWebError', () => {
  it('reports the failure without the cause chain RUM cannot scrub', () => {
    reportBillingWebError(
      new Error('Card declined', {
        cause: new Error('Declined for ada@example.com')
      }),
      { errorType: 'failure_confirming_checkout' }
    )

    const reported = vi.mocked(datadogRum.addError).mock.lastCall?.[0]
    expect(reported).toBeInstanceOf(Error)
    expect(reported).not.toHaveProperty('cause')
  })

  it('reports the failure to RUM under its type, tagged with the billing web surface', () => {
    const failure = new Error('Card declined')

    reportBillingWebError(failure, {
      errorType: 'failure_confirming_checkout',
      context: { billing_op_id: 'op_1' }
    })

    expect(datadogRum.addError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'failure_confirming_checkout',
        message: 'Card declined',
        stack: failure.stack
      }),
      {
        billing_op_id: 'op_1',
        error_type: 'failure_confirming_checkout',
        surface: 'billing',
        billing_surface: 'billing_web'
      }
    )
  })

  it('logs the failure once, and RUM drops that console copy', () => {
    reportBillingWebError(new Error('Card declined'), {
      errorType: 'failure_confirming_checkout'
    })

    expect(console.error).toHaveBeenCalledOnce()
    const logged = vi.mocked(console.error).mock.lastCall ?? []
    const consoleEcho: ScrubbableRumEvent = {
      type: 'error',
      view: { url: 'https://billing.comfy.org/v1/checkout' },
      error: { source: 'console', message: logged.map(String).join(' ') }
    }
    expect(billingWebRumBeforeSend(consoleEcho)).toBe(false)
  })

  it('logs only the redacted message, not the cause chain RUM would collect from the console', () => {
    reportBillingWebError(
      new Error(
        'Confirm failed for ada@example.com at https://billing.comfy.org/v1/checkout?payment_intent_client_secret=pi_1_secret_2',
        { cause: new Error('Declined for ada@example.com') }
      ),
      { errorType: 'failure_confirming_checkout' }
    )

    expect(vi.mocked(console.error).mock.lastCall).toEqual([
      '[Reported error]: failure_confirming_checkout',
      'Confirm failed for [email] at https://billing.comfy.org/v1/checkout'
    ])
  })

  it('never throws into the billing flow when RUM itself fails', () => {
    vi.mocked(datadogRum.addError).mockImplementation(() => {
      throw new Error('RUM unavailable')
    })

    expect(() =>
      reportBillingWebError(new Error('Card declined'), {
        errorType: 'failure_confirming_checkout'
      })
    ).not.toThrow()
  })
})
