import { describe, expect, it } from 'vitest'

import {
  WORKSPACE_LINK_PARAM,
  readWorkspaceLink
} from '@comfyorg/account-core/workspaceLink'

import { BILLING_INTENTS, BILLING_PRODUCTS } from './contract'
import { OPTIONAL_ENTRY_FIELDS } from './entryFields'
import { parseBillingEntry } from './entryParser'
import type { BillingEntryInput, BillingEntryUrlErrorCode } from './entryUrl'
import { buildBillingEntryUrl } from './entryUrl'

const BASE_INPUT: BillingEntryInput = {
  billingOrigin: 'https://billing.comfy.org',
  intent: 'checkout',
  product: 'platform',
  returnTo: 'platform_account'
}

function entryUrl(input: BillingEntryInput): URL {
  const result = buildBillingEntryUrl(input)
  if (result.status === 'error')
    throw new Error(`expected an entry URL, got ${result.code}`)
  return result.url
}

function errorCode(input: BillingEntryInput): BillingEntryUrlErrorCode | 'ok' {
  const result = buildBillingEntryUrl(input)
  return result.status === 'error' ? result.code : 'ok'
}

describe('buildBillingEntryUrl', () => {
  it('routes an intent under the contract version', () => {
    expect(entryUrl({ ...BASE_INPUT, intent: 'invoices' }).pathname).toBe(
      '/v1/invoices'
    )
  })

  it('keeps only the origin of a billing URL that carries a path', () => {
    expect(
      entryUrl({
        ...BASE_INPUT,
        billingOrigin: 'https://billing.comfy.org/app'
      }).href
    ).toBe(
      'https://billing.comfy.org/v1/checkout?product=platform&return_to=platform_account'
    )
  })

  it('omits an absent optional identifier rather than writing it empty', () => {
    expect(entryUrl(BASE_INPUT).search).toBe(
      '?product=platform&return_to=platform_account'
    )
  })

  it.for([
    ['https://billing.comfy.org', 'ok'],
    ['http://localhost:5174', 'ok'],
    ['http://127.0.0.1:5174', 'ok'],
    ['http://[::1]:5174', 'ok'],
    ['http://billing.comfy.org', 'INVALID_ORIGIN'],
    ['https://user:secret@billing.comfy.org', 'INVALID_ORIGIN'],
    ['ftp://billing.comfy.org', 'INVALID_ORIGIN'],
    ['not a url', 'INVALID_ORIGIN']
  ] as const)('reports %s as %s', ([billingOrigin, expected]) => {
    expect(errorCode({ ...BASE_INPUT, billingOrigin })).toBe(expected)
  })

  it.for([
    [{ returnTo: 'attacker_site' }, 'UNKNOWN_RETURN_TARGET'],
    [{ plan: 'pro plan' }, 'INVALID_PLAN'],
    [{ correlationId: '../escape' }, 'INVALID_CORRELATION_ID'],
    [{ workspaceId: '' }, 'INVALID_WORKSPACE_ID'],
    [{ teamCreditStopId: '../escape' }, 'INVALID_TEAM_CREDIT_STOP_ID']
  ] as const)('refuses %o with %s', ([overrides, expected]) => {
    expect(errorCode({ ...BASE_INPUT, ...overrides })).toBe(expected)
  })
})

describe('parseBillingEntry', () => {
  it.for(BILLING_INTENTS)('round-trips the %s intent', (intent) => {
    const url = entryUrl({
      ...BASE_INPUT,
      intent,
      plan: 'pro_monthly',
      correlationId: 'corr-1',
      workspaceId: 'ws_1',
      teamCreditStopId: 'stop_1'
    })

    expect(parseBillingEntry(url)).toEqual({
      status: 'ok',
      entry: {
        version: 'v1',
        intent,
        product: 'platform',
        returnTo: 'platform_account',
        plan: 'pro_monthly',
        correlationId: 'corr-1',
        workspaceId: 'ws_1',
        teamCreditStopId: 'stop_1'
      }
    })
  })

  it.for(BILLING_PRODUCTS)('round-trips the %s product', (product) => {
    const url = entryUrl({ ...BASE_INPUT, product })

    expect(parseBillingEntry(url)).toEqual({
      status: 'ok',
      entry: {
        version: 'v1',
        intent: 'checkout',
        product,
        returnTo: 'platform_account'
      }
    })
  })

  it('ignores a query parameter the contract does not name', () => {
    expect(
      parseBillingEntry(
        '/v1/pricing?product=workshop&return_to=comfyui_credits&utm_source=email'
      )
    ).toEqual({
      status: 'ok',
      entry: {
        version: 'v1',
        intent: 'pricing',
        product: 'workshop',
        returnTo: 'comfyui_credits'
      }
    })
  })

  it.for([
    [
      '/v2/checkout?product=platform&return_to=platform_account',
      'UNSUPPORTED_VERSION'
    ],
    ['nonsense', 'UNSUPPORTED_VERSION'],
    ['http://[', 'UNSUPPORTED_VERSION'],
    [
      '/v1/refunds?product=platform&return_to=platform_account',
      'UNKNOWN_INTENT'
    ],
    [
      '/v1/checkout/extra?product=platform&return_to=platform_account',
      'UNKNOWN_INTENT'
    ],
    ['/v1/checkout?return_to=platform_account', 'UNKNOWN_PRODUCT'],
    [
      '/v1/checkout?product=desktop&return_to=platform_account',
      'UNKNOWN_PRODUCT'
    ],
    ['/v1/checkout?product=platform', 'UNKNOWN_RETURN_TARGET'],
    [
      '/v1/checkout?product=platform&return_to=https://attacker.example',
      'UNKNOWN_RETURN_TARGET'
    ],
    [
      '/v1/checkout?product=platform&return_to=platform_account&plan=pro%20plan',
      'INVALID_PLAN'
    ],
    [
      '/v1/checkout?product=platform&return_to=platform_account&correlation_id=a/b',
      'INVALID_CORRELATION_ID'
    ],
    [
      '/v1/checkout?product=platform&return_to=platform_account&workspace=',
      'INVALID_WORKSPACE_ID'
    ],
    [
      '/v1/checkout?product=platform&return_to=platform_account&team_credit_stop_id=a/b',
      'INVALID_TEAM_CREDIT_STOP_ID'
    ]
  ] as const)('refuses %s with %s', ([url, expected]) => {
    expect(parseBillingEntry(url)).toEqual({ status: 'error', code: expected })
  })
})

describe('the workspace query parameter', () => {
  it('is the same name the auth SDK reads and writes', () => {
    const workspaceField = OPTIONAL_ENTRY_FIELDS.find(
      (field) => field.key === 'workspaceId'
    )
    expect(workspaceField?.param).toBe(WORKSPACE_LINK_PARAM)
  })

  it('agrees with the auth SDK that an empty value is rejected, not absent', () => {
    const url =
      '/v1/checkout?product=platform&return_to=platform_account&workspace='

    expect(parseBillingEntry(url)).toEqual({
      status: 'error',
      code: 'INVALID_WORKSPACE_ID'
    })
    expect(readWorkspaceLink(url)).toEqual({ status: 'invalid' })
  })
})
