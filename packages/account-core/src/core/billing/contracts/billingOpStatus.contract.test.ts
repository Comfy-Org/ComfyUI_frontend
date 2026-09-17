import { zBillingOpStatusResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type OpStatusBody = z.input<typeof zBillingOpStatusResponse>
type OpStatus = z.infer<typeof zBillingOpStatusResponse>

function opStatusBody(overrides: Partial<OpStatusBody> = {}): OpStatusBody {
  return {
    id: 'op-1',
    started_at: '2024-06-15T12:00:00.000Z',
    status: 'pending',
    ...overrides
  }
}

/** Every value the reducer distinguishes; 'pending' is its stay-put branch. */
const REDUCED_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'reconciliation_needed'
] as const satisfies readonly OpStatus['status'][]

/** Every value the pending reducer reads or `settleChallenge` assigns. */
const AUTHENTICATION_STATES = [
  'requires_action',
  'processing',
  'failed_retryable',
  'succeeded',
  'reconciliation_needed'
] as const satisfies readonly NonNullable<OpStatus['authentication_state']>[]

describe('billing operation status contract', () => {
  it('accepts a status carrying only the required fields', () => {
    expect(zBillingOpStatusResponse.safeParse(opStatusBody())).toMatchObject({
      success: true
    })
  })

  it('requires a datetime start time, so a malformed one fails the whole poll', () => {
    expect(
      zBillingOpStatusResponse.safeParse(
        opStatusBody({ started_at: 'not-a-date' })
      ).success
    ).toBe(false)
  })

  it('carries exactly the four statuses the reducer handles', () => {
    expectTypeOf<OpStatus['status']>().toEqualTypeOf<
      (typeof REDUCED_STATUSES)[number]
    >()
  })

  it.for(REDUCED_STATUSES)('accepts the %s status', (status) => {
    expect(
      zBillingOpStatusResponse.safeParse(opStatusBody({ status }))
    ).toMatchObject({ success: true })
  })

  it('carries exactly the five authentication states the reducer reads', () => {
    expectTypeOf<OpStatus['authentication_state']>().toEqualTypeOf<
      (typeof AUTHENTICATION_STATES)[number] | undefined
    >()
  })

  it.for(AUTHENTICATION_STATES)(
    'accepts the %s authentication state',
    (authentication_state) => {
      expect(
        zBillingOpStatusResponse.safeParse(
          opStatusBody({ authentication_state })
        )
      ).toMatchObject({ success: true })
    }
  )

  it('carries the decline reasons a failed operation reports, including the generic fallback', () => {
    expectTypeOf<OpStatus['decline_reason']>().toEqualTypeOf<
      | 'card_declined'
      | 'insufficient_funds'
      | 'expired_card'
      | 'incorrect_cvc'
      | 'authentication_required'
      | 'authentication_failed'
      | 'processing_error'
      | 'generic'
      | undefined
    >()
  })

  it('carries the recovery actions a host offers after a decline', () => {
    expectTypeOf<OpStatus['recovery_action']>().toEqualTypeOf<
      | 'retry'
      | 'replace_payment_method'
      | 'authenticate_payment'
      | 'contact_support'
      | undefined
    >()
  })

  it('carries the server phases the pending state mirrors', () => {
    expectTypeOf<OpStatus['phase']>().toEqualTypeOf<
      | 'awaiting_payment_method'
      | 'awaiting_invoice_payment'
      | 'in_progress'
      | undefined
    >()
  })

  it('identifies the operation and its continuations as plain strings', () => {
    expectTypeOf<OpStatus['id']>().toEqualTypeOf<string>()
    expectTypeOf<OpStatus['action_url']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<OpStatus['payment_intent_client_secret']>().toEqualTypeOf<
      string | undefined
    >()
  })

  it('leaves retryable absent by default, so a decline is not retryable unless the server says so', () => {
    expectTypeOf<OpStatus['retryable']>().toEqualTypeOf<boolean | undefined>()

    const parsed = zBillingOpStatusResponse.safeParse(
      opStatusBody({ status: 'failed' })
    )

    expect(parsed.success && parsed.data.retryable).toBeUndefined()
  })
})
