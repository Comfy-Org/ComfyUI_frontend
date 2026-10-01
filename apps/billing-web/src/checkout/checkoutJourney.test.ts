import { describe, expect, it } from 'vitest'

import type {
  BillingTelemetryFailureCategory,
  CheckoutEntryFlow,
  CheckoutEntrySource,
  PreviewSubscribeResult,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { BillingSource } from '@comfyorg/billing-contract'

import type { CheckoutPageEvent } from '@/checkout/checkoutPage'
import {
  entryFlowOf,
  entrySourceOf,
  failureCategoryOf,
  previewFailureOfPageEvent,
  previewFailureOfResult,
  previewReadyPhase
} from '@/checkout/checkoutJourney'
import { previewOf } from '@/test/fakeBillingClient'

describe('entrySourceOf', () => {
  it.for<{
    source: BillingSource | undefined
    expected: CheckoutEntrySource
  }>([
    { source: undefined, expected: 'unknown' },
    { source: 'agent_paywall', expected: 'agent_paywall' },
    { source: 'deep_link', expected: 'deep_link' },
    { source: 'settings_billing_panel', expected: 'settings_billing' },
    { source: 'subscribe_to_run', expected: 'other' },
    { source: 'team_members_panel', expected: 'other' }
  ])('reads $source as $expected', ({ source, expected }) => {
    expect(entrySourceOf(source)).toBe(expected)
  })
})

describe('entryFlowOf', () => {
  it.for<{
    transition: SubscriptionPreview['transition_type']
    expected: CheckoutEntryFlow
  }>([
    { transition: 'new_subscription', expected: 'initial_subscription' },
    { transition: 'upgrade', expected: 'paid_upgrade' },
    { transition: 'downgrade', expected: 'paid_upgrade' },
    { transition: 'duration_change', expected: 'paid_upgrade' }
  ])('reads a $transition quote as $expected', ({ transition, expected }) => {
    expect(entryFlowOf({ transition_type: transition })).toBe(expected)
  })
})

describe('failureCategoryOf', () => {
  it.for<{
    name: string
    failure: { code: string; httpStatus?: number }
    expected: BillingTelemetryFailureCategory
  }>([
    {
      name: 'a request that never got an answer is a network failure',
      failure: { code: 'REQUEST_FAILED' },
      expected: 'network'
    },
    {
      name: 'a request the server answered with an error status is a rejection',
      failure: { code: 'REQUEST_FAILED', httpStatus: 503 },
      expected: 'api_rejected'
    },
    {
      name: 'a refusal of the session is a rejection',
      failure: { code: 'ACCESS_DENIED' },
      expected: 'api_rejected'
    },
    {
      name: 'a sign-in that lapsed is a rejection',
      failure: { code: 'NOT_AUTHENTICATED' },
      expected: 'api_rejected'
    },
    {
      name: 'a plan the server cannot find is a rejection',
      failure: { code: 'NOT_FOUND' },
      expected: 'api_rejected'
    },
    {
      name: 'a business conflict is a rejection',
      failure: { code: 'CONFLICT' },
      expected: 'api_rejected'
    },
    {
      name: 'an operation the server already holds is a rejection',
      failure: { code: 'OPERATION_ALREADY_PENDING' },
      expected: 'api_rejected'
    },
    {
      name: 'a subscription the server cannot change is a rejection',
      failure: { code: 'NO_ACTIVE_SUBSCRIPTION' },
      expected: 'api_rejected'
    },
    {
      name: 'a request the contract refuses to send is a validation failure',
      failure: { code: 'INVALID_REQUEST' },
      expected: 'validation'
    },
    {
      name: 'a body that breaks the contract is unknown',
      failure: { code: 'MALFORMED_RESPONSE' },
      expected: 'unknown'
    },
    {
      name: 'a code nobody has named is unknown',
      failure: { code: 'A_CODE_NOBODY_HAS_HEARD_OF' },
      expected: 'unknown'
    }
  ])('$name', ({ failure, expected }) => {
    expect(failureCategoryOf(failure)).toBe(expected)
  })
})

describe('previewReadyPhase', () => {
  it.for<{
    name: string
    quoted: SubscriptionPreview
    revision: string | undefined
  }>([
    {
      name: 'a quote with an identity names its revision',
      quoted: previewOf({ quote_id: 'q_1', quote_version: 3 }),
      revision: 'q_1:3'
    },
    {
      name: 'a quote without an identity names no revision',
      quoted: previewOf(),
      revision: undefined
    },
    {
      name: 'a quote with an id but no version names no revision',
      quoted: previewOf({ quote_id: 'q_1' }),
      revision: undefined
    }
  ])('$name', ({ quoted, revision }) => {
    expect(previewReadyPhase(quoted)).toStrictEqual({
      phase: 'preview_ready',
      ...(revision === undefined ? {} : { preview_revision: revision })
    })
  })
})

describe('previewFailureOfPageEvent', () => {
  it.for<{
    name: string
    event: CheckoutPageEvent
    failed: object | undefined
  }>([
    {
      name: 'a refused capability names its denial',
      event: { type: 'refused', reason: 'not_workspace_owner' },
      failed: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        denial_reason: 'not_workspace_owner'
      }
    },
    {
      name: 'an unreadable capability read is categorised by its failure',
      event: { type: 'capabilitiesFailed', code: 'REQUEST_FAILED' },
      failed: { phase: 'preview_failed', failure_category: 'network' }
    },
    {
      name: 'an unreadable quote the server answered is a rejection',
      event: { type: 'unavailable', code: 'REQUEST_FAILED', httpStatus: 400 },
      failed: { phase: 'preview_failed', failure_category: 'api_rejected' }
    },
    {
      name: 'a quote the server refuses names the checkout code',
      event: { type: 'notAllowed' },
      failed: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        error_code: 'quote_not_allowed'
      }
    },
    {
      name: 'a plan the catalog no longer has is the server refusing it',
      event: { type: 'planUnavailable', reason: 'retired' },
      failed: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        error_code: 'plan_unavailable'
      }
    },
    {
      name: 'a team plan without its stop is an invalid link',
      event: { type: 'planUnavailable', reason: 'team_stop_missing' },
      failed: {
        phase: 'preview_failed',
        failure_category: 'validation',
        error_code: 'plan_unavailable'
      }
    },
    {
      name: 'a page event that is not a failed preview reports nothing',
      event: { type: 'savedFailed' },
      failed: undefined
    }
  ])('$name', ({ event, failed }) => {
    expect(previewFailureOfPageEvent(event)).toStrictEqual(failed)
  })
})

describe('previewFailureOfResult', () => {
  it.for<{
    name: string
    result: PreviewSubscribeResult
    failed: object | undefined
  }>([
    {
      name: 'an allowed quote is not a failure',
      result: { status: 'ok', value: previewOf() },
      failed: undefined
    },
    {
      name: 'a quote the server refuses fails with the checkout code',
      result: { status: 'ok', value: previewOf({ allowed: false }) },
      failed: {
        phase: 'preview_failed',
        failure_category: 'api_rejected',
        error_code: 'quote_not_allowed'
      }
    },
    {
      name: 'a failed read is categorised by its failure',
      result: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 500 },
      failed: { phase: 'preview_failed', failure_category: 'api_rejected' }
    },
    {
      name: 'a read that never got an answer is a network failure',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      failed: { phase: 'preview_failed', failure_category: 'network' }
    },
    {
      name: 'a read a newer quote overtook reports nothing',
      result: { status: 'error', code: 'SUPERSEDED' },
      failed: undefined
    }
  ])('$name', ({ result, failed }) => {
    expect(previewFailureOfResult(result)).toStrictEqual(failed)
  })
})
