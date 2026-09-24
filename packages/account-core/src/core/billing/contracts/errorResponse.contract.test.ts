import { zErrorResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type ErrorBody = z.input<typeof zErrorResponse>
type ErrorResponse = z.infer<typeof zErrorResponse>

function errorBody(): ErrorBody {
  return {
    code: 'NO_PAYMENT_METHOD',
    message: 'The workspace has no payment method on file.'
  }
}

// Compile-time pins: a regen that moves these fails the package typecheck.

// An open string the commands match against their own closed set of codes.
expectTypeOf<ErrorResponse['code']>().toEqualTypeOf<string>()

describe('billing error body contract', () => {
  it('accepts an error carrying only a code and a message', () => {
    expect(zErrorResponse.safeParse(errorBody())).toMatchObject({
      success: true
    })
  })

  it('rejects a body without a message', () => {
    expect(
      zErrorResponse.safeParse({ code: 'NO_PAYMENT_METHOD' }).success
    ).toBe(false)
  })
})
