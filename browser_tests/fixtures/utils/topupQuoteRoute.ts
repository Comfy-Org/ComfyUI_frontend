import type { Page } from '@playwright/test'
import type {
  CreateTopupQuoteRequest,
  TopupQuoteResponse
} from '@comfyorg/ingest-types'

/** Quotes any top-up amount at a fixed credit rate. */
export async function mockTopupQuote(page: Page): Promise<void> {
  await page.route('**/api/billing/topup/quote', (route) => {
    const { amount_cents } = route
      .request()
      .postDataJSON() as CreateTopupQuoteRequest
    return route.fulfill({
      json: {
        amount_cents,
        credits: Math.round(amount_cents * 2.11),
        expires_at: '2099-01-01T00:00:00Z'
      } satisfies TopupQuoteResponse
    })
  })
}
