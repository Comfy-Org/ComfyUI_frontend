import { zPaymentPortalResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type PortalBody = z.input<typeof zPaymentPortalResponse>
type Portal = z.infer<typeof zPaymentPortalResponse>

function portalResponse(overrides: Partial<PortalBody> = {}): PortalBody {
  return { url: 'https://billing.comfy.org/portal/session-1', ...overrides }
}

describe('payment portal contract', () => {
  it('accepts a response carrying only the portal url', () => {
    expect(zPaymentPortalResponse.safeParse(portalResponse())).toMatchObject({
      success: true
    })
  })

  it('requires the url, which the command still re-checks for https itself', () => {
    expectTypeOf<Portal['url']>().toEqualTypeOf<string>()
    expect(zPaymentPortalResponse.safeParse({}).success).toBe(false)
    expect(
      zPaymentPortalResponse.safeParse(portalResponse({ url: 'http://host' }))
        .success
    ).toBe(true)
  })
})
