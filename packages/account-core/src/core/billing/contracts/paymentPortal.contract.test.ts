import { zPaymentPortalResponse } from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type PortalBody = z.input<typeof zPaymentPortalResponse>
type Portal = z.infer<typeof zPaymentPortalResponse>

function portalResponse(overrides: Partial<PortalBody> = {}): PortalBody {
  return { url: 'https://billing.comfy.org/portal/session-1', ...overrides }
}

// Compile-time pins: a regen that moves these fails the package typecheck.
expectTypeOf<Portal['url']>().toEqualTypeOf<string>()

describe('payment portal contract', () => {
  it('accepts a response carrying only the portal url', () => {
    expect(zPaymentPortalResponse.safeParse(portalResponse())).toMatchObject({
      success: true
    })
  })

  it('requires the url', () => {
    expect(zPaymentPortalResponse.safeParse({}).success).toBe(false)
  })

  it('validates the url no further than a string, so the command checks the scheme itself', () => {
    expect(
      zPaymentPortalResponse.safeParse(portalResponse({ url: 'http://host' }))
    ).toMatchObject({ success: true })
    expect(
      zPaymentPortalResponse.safeParse(portalResponse({ url: 'not-a-url' }))
    ).toMatchObject({ success: true })
  })
})
