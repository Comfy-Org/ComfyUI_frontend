import { describe, expect, it } from 'vitest'

import { topupCheckoutReturnUrl } from './topupCheckoutReturnUrl'

const appUrl = 'http://127.0.0.1:8000/?settings=workspace'

describe('topupCheckoutReturnUrl', () => {
  it('returns cloud web to the page the checkout started from', () => {
    expect(
      topupCheckoutReturnUrl({
        servesCloudWeb: true,
        currentUrl: 'https://cloud.comfy.org/?settings=workspace',
        billingWebBase: new URL('https://billing.comfy.org'),
        environment: 'production'
      })
    ).toBe('https://cloud.comfy.org/?settings=workspace')
  })

  it.for([
    {
      name: 'the server-sent billing-web origin',
      billingWebBase: new URL('https://billing.comfy.org'),
      environment: undefined,
      expected: 'https://billing.comfy.org/return/topup'
    },
    {
      name: 'a prefixed billing-web deployment',
      billingWebBase: new URL('https://preview.comfy.org/billing/'),
      environment: undefined,
      expected: 'https://preview.comfy.org/billing/return/topup'
    },
    {
      name: 'the production origin when the local server sends none',
      billingWebBase: null,
      environment: 'production',
      expected: 'https://billing.comfy.org/return/topup'
    },
    {
      name: 'the staging origin when the local server sends none',
      billingWebBase: null,
      environment: 'staging',
      expected: 'https://stagingbilling.comfy.org/return/topup'
    },
    {
      name: 'the test origin when the local server sends none',
      billingWebBase: null,
      environment: 'test',
      expected: 'https://testbilling.comfy.org/return/topup'
    },
    {
      name: 'nothing when no origin resolves',
      billingWebBase: null,
      environment: undefined,
      expected: undefined
    }
  ] as const)(
    'returns non-cloud-web builds to $name',
    ({ billingWebBase, environment, expected }) => {
      expect(
        topupCheckoutReturnUrl({
          servesCloudWeb: false,
          currentUrl: appUrl,
          billingWebBase,
          environment
        })
      ).toBe(expected)
    }
  )
})
