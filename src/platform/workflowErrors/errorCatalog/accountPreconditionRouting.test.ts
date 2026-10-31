import { describe, expect, it } from 'vitest'

import {
  isAccountPreconditionCatalogId,
  preconditionForCatalogId,
  resolveAccountPrecondition
} from './accountPreconditionRouting'
import {
  EXECUTION_FAILED_CATALOG_ID,
  INSUFFICIENT_CREDITS_CATALOG_ID,
  SIGN_IN_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_REQUIRED_CATALOG_ID,
  SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID,
  WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID
} from './catalogIds'

describe('resolveAccountPrecondition', () => {
  it('classifies a sign-in error', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'RuntimeError',
        exceptionMessage: 'Unauthorized: Please login first to use this node.'
      })
    ).toBe('sign_in')
  })

  it('classifies an inactive-subscription error', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'InactiveSubscriptionError',
        exceptionMessage:
          'User has no active subscription. Please subscribe to a plan to continue.'
      })
    ).toBe('subscription')
  })

  it('classifies the queue paywall (PAYMENT_REQUIRED) as a subscription precondition', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'PAYMENT_REQUIRED',
        exceptionMessage: 'Subscription required to queue workflows'
      })
    ).toBe('subscription')
  })

  it('keeps the retryable FREE_TIER_UNAVAILABLE 429 out of the subscription route', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'FREE_TIER_UNAVAILABLE',
        exceptionMessage: 'Subscription required to queue workflows'
      })
    ).toBeUndefined()
  })

  it.for([
    'CLOUD_SUBSCRIPTION_REQUIRED',
    'FREE_TIER_EXHAUSTED',
    'PARTNER_NODE_PAYMENT_REQUIRED',
    'MODEL_PAYMENT_REQUIRED'
  ])(
    'prefers the ExecutePrompt %s type over a conflicting credit message',
    (exceptionType) => {
      expect(
        resolveAccountPrecondition({
          exceptionType,
          exceptionMessage:
            'Payment Required: Please add credits to your account to use this node.'
        })
      ).toBe('subscription')
    }
  )

  it('classifies a subscription-upgrade error as a subscription precondition', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'RuntimeError',
        exceptionMessage:
          'the following private models require a subscription upgrade: flux-pro'
      })
    ).toBe('subscription')
  })

  it('classifies an account credit error', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'InsufficientFundsError',
        exceptionMessage:
          'Payment Required: Please add credits to your account to use this node.'
      })
    ).toBe('credits')
  })

  it('classifies a workspace credit error', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'RuntimeError',
        exceptionMessage:
          'Payment Required: Please add credits to your workspace to continue.'
      })
    ).toBe('credits')
  })

  it('classifies the submit-time 402 body by its insufficient_credits type regardless of message', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'insufficient_credits',
        exceptionMessage: 'Workspace balance exhausted'
      })
    ).toBe('credits')
  })

  it('classifies the team submit-time 429 (PAYMENT_REQUIRED / insufficient credits) as a credits precondition', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'PAYMENT_REQUIRED',
        exceptionMessage: 'Insufficient credits to queue workflows'
      })
    ).toBe('credits')
  })

  it('keeps the team submit-time 429 for an inactive subscription on the subscription precondition', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'PAYMENT_REQUIRED',
        exceptionMessage: 'Subscription required to queue workflows'
      })
    ).toBe('subscription')
  })

  it.for([
    {
      message:
        'Payment Required: This session is set to bill your personal account, which is out of credits.',
      expected: 'personal_wallet_session'
    },
    {
      message:
        'Payment Required: This API key bills your personal account, which is out of credits.',
      expected: 'personal_wallet_api_key'
    }
  ])('routes a personal-wallet 402 to $expected', ({ message, expected }) => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'RuntimeError',
        exceptionMessage: message
      })
    ).toBe(expected)
  })

  it('returns undefined for an ordinary workflow error', () => {
    expect(
      resolveAccountPrecondition({
        exceptionType: 'RuntimeError',
        exceptionMessage: 'CUDA out of memory'
      })
    ).toBeUndefined()
  })
})

describe('preconditionForCatalogId / isAccountPreconditionCatalogId', () => {
  it('maps every precondition catalog id', () => {
    expect(preconditionForCatalogId(SIGN_IN_REQUIRED_CATALOG_ID)).toBe(
      'sign_in'
    )
    expect(preconditionForCatalogId(SUBSCRIPTION_REQUIRED_CATALOG_ID)).toBe(
      'subscription'
    )
    expect(
      preconditionForCatalogId(SUBSCRIPTION_UPGRADE_REQUIRED_CATALOG_ID)
    ).toBe('subscription')
    expect(preconditionForCatalogId(INSUFFICIENT_CREDITS_CATALOG_ID)).toBe(
      'credits'
    )
    expect(
      preconditionForCatalogId(WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID)
    ).toBe('credits')
  })

  it('does not treat a workflow error catalog id as a precondition', () => {
    expect(
      preconditionForCatalogId(EXECUTION_FAILED_CATALOG_ID)
    ).toBeUndefined()
    expect(isAccountPreconditionCatalogId(EXECUTION_FAILED_CATALOG_ID)).toBe(
      false
    )
    expect(isAccountPreconditionCatalogId(undefined)).toBe(false)
  })
})
