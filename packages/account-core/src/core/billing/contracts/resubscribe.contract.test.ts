import { zResubscribeResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type ResubscribeBody = z.input<typeof zResubscribeResponse>
type Resubscribe = z.infer<typeof zResubscribeResponse>

function resubscribeResponse(
  overrides: Partial<ResubscribeBody> = {}
): ResubscribeBody {
  return { billing_op_id: 'op-1', status: 'active', ...overrides }
}

const RESUBSCRIBE_STATUSES = [
  'active',
  'pending'
] as const satisfies readonly Resubscribe['status'][]

describe('resubscribe contract', () => {
  it('accepts a response carrying only the operation id and its status', () => {
    expect(zResubscribeResponse.safeParse(resubscribeResponse())).toMatchObject(
      {
        success: true
      }
    )
  })

  it('returns the operation id the lifecycle adopts', () => {
    expectTypeOf<Resubscribe['billing_op_id']>().toEqualTypeOf<string>()
  })

  it('carries exactly the two statuses a resubscribe settles into', () => {
    expectTypeOf<Resubscribe['status']>().toEqualTypeOf<
      (typeof RESUBSCRIBE_STATUSES)[number]
    >()
  })

  it.for(RESUBSCRIBE_STATUSES)(
    'carries the operation id alongside the %s status',
    (status) => {
      const parsed = zResubscribeResponse.safeParse(
        resubscribeResponse({ status })
      )

      expect(parsed.success && parsed.data.billing_op_id).toBe('op-1')
    }
  )
})
