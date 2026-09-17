import { zErrorResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type ErrorBody = z.input<typeof zErrorResponse>
type ErrorResponse = z.infer<typeof zErrorResponse>

function errorBody(overrides: Partial<ErrorBody> = {}): ErrorBody {
  return {
    code: 'NO_PAYMENT_METHOD',
    message: 'The workspace has no payment method on file.',
    ...overrides
  }
}

describe('billing error body contract', () => {
  it('accepts an error carrying only a code and a message', () => {
    expect(zErrorResponse.safeParse(errorBody())).toMatchObject({
      success: true
    })
  })

  it('reports the code as an open string the commands match against their own closed set', () => {
    expectTypeOf<ErrorResponse['code']>().toEqualTypeOf<string>()
  })

  it('rejects a body without a message', () => {
    expect(
      zErrorResponse.safeParse({ code: 'NO_PAYMENT_METHOD' }).success
    ).toBe(false)
  })
})
