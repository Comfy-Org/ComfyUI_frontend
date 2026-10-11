import { zCancelSubscriptionResponse2 } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type CancelBody = z.input<typeof zCancelSubscriptionResponse2>
type Cancel = z.infer<typeof zCancelSubscriptionResponse2>

const CANCEL_VARIANTS = [
  {
    variant: 'scheduled',
    body: { billing_op_id: 'op-1', cancel_at: '2024-07-15T12:00:00.000Z' }
  },
  {
    variant: 'accepted',
    body: { billing_op_id: 'op-1', status: 'pending' }
  }
] as const satisfies readonly { variant: string; body: CancelBody }[]

// Compile-time pins: a regen that moves these fails the package typecheck.

// Every member of the response union carries the operation id.
expectTypeOf<Cancel['billing_op_id']>().toEqualTypeOf<string>()

describe('cancel subscription contract', () => {
  it.for(CANCEL_VARIANTS)(
    'reads the operation id off the $variant response',
    ({ body }) => {
      const parsed = zCancelSubscriptionResponse2.safeParse(body)

      expect(parsed.success && parsed.data.billing_op_id).toBe('op-1')
    }
  )

  it('rejects a scheduled cancellation dated by an unreadable timestamp', () => {
    const parsed = zCancelSubscriptionResponse2.safeParse({
      billing_op_id: 'op-1',
      cancel_at: 'not-a-date'
    })

    expect(parsed.success).toBe(false)
  })
})
