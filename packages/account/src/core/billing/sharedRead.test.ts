import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type {
  BillingHttpResponse,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import { readValidatedBillingResponse } from './sharedRead.js'

const REQUEST = { method: 'GET', route: '/billing/topup' } as const
const Body = z.object({ ok: z.literal(true) })

function answering(
  httpStatus: number,
  body: unknown,
  extra: Pick<BillingHttpResponse, 'authenticationRetrySkipped'> = {}
): BillingTransport {
  const answer: BillingResult<BillingHttpResponse> = {
    status: 'ok',
    value: { httpStatus, body, header: () => null, ...extra }
  }
  return async () => answer
}

describe('readValidatedBillingResponse', () => {
  it('carries the coded server error and never its message', async () => {
    const result = await readValidatedBillingResponse(
      answering(400, {
        code: 'NO_PAYMENT_METHOD',
        message: 'Stripe: no default payment method on customer cus_123'
      }),
      REQUEST,
      (body) => Body.safeParse(body)
    )

    expect(result).toEqual({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 400,
      serverCode: 'NO_PAYMENT_METHOD'
    })
    expect(JSON.stringify(result)).not.toContain('Stripe')
  })

  it.for([
    {
      name: 'a 401 the transport re-minted and retried is a denial',
      extra: {},
      code: 'ACCESS_DENIED'
    },
    {
      name: 'a 401 the transport could not replay is transient',
      extra: { authenticationRetrySkipped: true as const },
      code: 'REQUEST_FAILED'
    }
  ])('$name', async ({ extra, code }) => {
    const result = await readValidatedBillingResponse(
      answering(401, {}, extra),
      REQUEST,
      (body) => Body.safeParse(body)
    )

    expect(result).toEqual({ status: 'error', code, httpStatus: 401 })
  })

  it('omits the server code when the error body is not the generated contract', async () => {
    const result = await readValidatedBillingResponse(
      answering(404, { error: 'not found' }),
      REQUEST,
      (body) => Body.safeParse(body)
    )

    expect(result).toEqual({
      status: 'error',
      code: 'NOT_FOUND',
      httpStatus: 404
    })
  })
})
