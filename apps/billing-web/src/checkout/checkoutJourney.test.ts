import { describe, expect, it } from 'vitest'

import { readBillingErrorCode } from '@comfyorg/account-core/billing'
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
  methodSelectedPhase,
  previewFailureOfPageEvent,
  previewFailureOfResult,
  previewReadyPhase,
  promoResultOfQuote,
  promoSettlementOf
} from '@/checkout/checkoutJourney'
import type { PromoEntry } from '@/checkout/promoEntry'
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

describe('methodSelectedPhase', () => {
  it.for<{
    name: string
    rail: 'saved' | 'new' | 'on_file'
    methodType: string | undefined
    selected: object
  }>([
    {
      name: 'a new card',
      rail: 'new',
      methodType: 'card',
      selected: { phase: 'method_selected', rail: 'new', method_kind: 'card' }
    },
    {
      name: 'a new Alipay account',
      rail: 'new',
      methodType: 'alipay',
      selected: { phase: 'method_selected', rail: 'new', method_kind: 'alipay' }
    },
    {
      name: 'a new method of any other type',
      rail: 'new',
      methodType: 'sepa_debit',
      selected: { phase: 'method_selected', rail: 'new', method_kind: 'other' }
    },
    {
      name: 'a saved card',
      rail: 'saved',
      methodType: 'card',
      selected: { phase: 'method_selected', rail: 'saved', method_kind: 'card' }
    },
    {
      name: 'a saved method the list gives no type',
      rail: 'saved',
      methodType: '',
      selected: { phase: 'method_selected', rail: 'saved' }
    },
    {
      name: 'the method on file, whose type this page never learns',
      rail: 'on_file',
      methodType: undefined,
      selected: { phase: 'method_selected', rail: 'on_file' }
    }
  ])('names $name', ({ rail, methodType, selected }) => {
    expect(methodSelectedPhase(rail, methodType)).toStrictEqual(selected)
  })
})

describe('promoSettlementOf', () => {
  it.for<{
    name: string
    before: PromoEntry
    after: PromoEntry
    settled: object | undefined
  }>([
    {
      name: 'a code the server priced is applied',
      before: { kind: 'applying', draft: 'SPRING' },
      after: { kind: 'applied', code: 'SPRING' },
      settled: { result: 'applied', code: 'SPRING' }
    },
    {
      name: 'a code the server refused is rejected',
      before: { kind: 'applying', draft: 'NOPE' },
      after: { kind: 'rejected', draft: 'NOPE', reason: 'invalid' },
      settled: { result: 'rejected', code: 'NOPE' }
    },
    {
      name: 'a code no quote could judge is not a verdict',
      before: { kind: 'applying', draft: 'SPRING' },
      after: { kind: 'rejected', draft: 'SPRING', reason: 'unchecked' },
      settled: undefined
    },
    {
      name: 'a code taken off is removed',
      before: { kind: 'removing', code: 'SPRING' },
      after: { kind: 'idle' },
      settled: { result: 'removed', code: 'SPRING' }
    },
    {
      name: 'a removal that failed keeps the code and reports nothing',
      before: { kind: 'removing', code: 'SPRING' },
      after: { kind: 'applied', code: 'SPRING' },
      settled: undefined
    },
    {
      name: 'an applied code Pay found lapsed is expired',
      before: { kind: 'applied', code: 'SPRING' },
      after: { kind: 'idle' },
      settled: { result: 'expired', code: 'SPRING' }
    },
    {
      name: 'typing a code is not a result',
      before: { kind: 'editing', draft: 'SPR' },
      after: { kind: 'editing', draft: 'SPRI' },
      settled: undefined
    },
    {
      name: 'a code sent to be priced is not a result yet',
      before: { kind: 'editing', draft: 'SPRING' },
      after: { kind: 'applying', draft: 'SPRING' },
      settled: undefined
    },
    {
      name: 'a code sent to be removed is not a result yet',
      before: { kind: 'applied', code: 'SPRING' },
      after: { kind: 'removing', code: 'SPRING' },
      settled: undefined
    }
  ])('$name', ({ before, after, settled }) => {
    expect(promoSettlementOf(before, after)).toStrictEqual(settled)
  })
})

describe('promoResultOfQuote', () => {
  it.for<{
    name: string
    result: PreviewSubscribeResult
    settled: 'applied' | 'rejected' | undefined
  }>([
    {
      name: 'a quote that carries the code back applied it',
      result: {
        status: 'ok',
        value: previewOf({ promotion_code: 'SPRING' })
      },
      settled: 'applied'
    },
    {
      name: 'a quote that drops the code rejected it',
      result: { status: 'ok', value: previewOf() },
      settled: 'rejected'
    },
    {
      name: 'a code the server calls invalid is rejected',
      result: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 400,
        serverCode: readBillingErrorCode({
          code: 'PROMOTION_CODE_INVALID',
          message: 'no'
        })
      },
      settled: 'rejected'
    },
    {
      name: 'a code the server calls inapplicable is rejected',
      result: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 400,
        serverCode: readBillingErrorCode({
          code: 'PROMOTION_CODE_INAPPLICABLE',
          message: 'no'
        })
      },
      settled: 'rejected'
    },
    {
      name: 'a quote that failed for another reason judged nothing',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      settled: undefined
    }
  ])('$name', ({ result, settled }) => {
    expect(promoResultOfQuote(result)).toBe(settled)
  })
})
