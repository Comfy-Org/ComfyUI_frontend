import { describe, expect, it } from 'vitest'

import type { BillingFailure } from './billingContracts.js'
import { matchesServerCode, unwrapServerCode } from './billingContracts.js'
import { readBillingErrorCode } from './billingErrorBody.js'

function failureFrom(body: unknown): BillingFailure {
  return {
    status: 'error',
    code: 'REQUEST_FAILED',
    httpStatus: 402,
    serverCode: readBillingErrorCode(body)
  }
}

const NO_PAYMENT_METHOD = failureFrom({
  code: 'NO_PAYMENT_METHOD',
  message: 'Stripe customer cus_123 has no default payment method'
})

describe('matchesServerCode', () => {
  it.for([
    {
      name: 'the decoded code matches the one a command names',
      failure: NO_PAYMENT_METHOD,
      code: 'NO_PAYMENT_METHOD',
      expected: true
    },
    {
      name: 'a different code does not match',
      failure: NO_PAYMENT_METHOD,
      code: 'ALREADY_CANCELED',
      expected: false
    },
    {
      name: 'a failure that carried no error body matches nothing',
      failure: failureFrom({ detail: 'not an ErrorResponse' }),
      code: 'NO_PAYMENT_METHOD',
      expected: false
    }
  ])('$name', ({ failure, code, expected }) => {
    expect(matchesServerCode(failure, code)).toBe(expected)
  })
})

describe('BillingServerCode', () => {
  it('takes a code only from the decoder, and erases to that same string', () => {
    const failure: BillingFailure = {
      status: 'error',
      code: 'REQUEST_FAILED',
      // @ts-expect-error only readBillingErrorCode mints a BillingServerCode
      serverCode: 'NO_PAYMENT_METHOD'
    }

    expect(failure.serverCode).toBe(NO_PAYMENT_METHOD.serverCode)
  })
})

describe('unwrapServerCode', () => {
  it('widens a decoded code back to the string the server sent', () => {
    const code = readBillingErrorCode({
      code: 'ALREADY_CANCELED',
      message: 'Subscription sub_123 is already canceled'
    })

    expect(code && unwrapServerCode(code)).toBe('ALREADY_CANCELED')
  })
})
