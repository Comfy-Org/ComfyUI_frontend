import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

export type TopupCheckoutBanner =
  | { kind: 'failed'; sessionId: string; paymentAmountCents: number | null }
  | { kind: 'creditsApplying'; sessionId: string }
  | { kind: 'processing'; sessionId: string }

export interface TopupCheckoutSnapshot {
  newestSessionId: string | null
  checkouts: readonly HostedTopupCheckout[]
}

const RANKED_KINDS = [
  'failed',
  'creditsApplying',
  'processing'
] as const satisfies readonly TopupCheckoutBanner['kind'][]

function servedPaymentAmount(cents: number | null): number | null {
  return cents !== null && Number.isSafeInteger(cents) && cents >= 0
    ? cents
    : null
}

function bannerForCheckout(
  checkout: HostedTopupCheckout,
  newestSessionId: string | null
): TopupCheckoutBanner | null {
  const sessionId = checkout.session_id
  switch (checkout.state) {
    case 'failed':
      return sessionId === newestSessionId
        ? {
            kind: 'failed',
            sessionId,
            paymentAmountCents: servedPaymentAmount(
              checkout.payment_amount_cents
            )
          }
        : null
    case 'credits_applying':
      return { kind: 'creditsApplying', sessionId }
    case 'payment_processing':
      return { kind: 'processing', sessionId }
    default:
      return null
  }
}

export function addCreditsEmphasis(
  availableCents: number | null,
  banner: TopupCheckoutBanner | null
): 'secondary' | 'inverted' {
  return availableCents === 0 && banner?.kind === 'failed'
    ? 'inverted'
    : 'secondary'
}

export function topupCheckoutBannerKey(banner: TopupCheckoutBanner): string {
  return `${banner.sessionId}:${banner.kind}`
}

/** The hosted top-up banner to show; a failed one only while newest. */
export function selectTopupCheckoutBanner(
  snapshot: TopupCheckoutSnapshot,
  dismissed: ReadonlySet<string>
): TopupCheckoutBanner | null {
  const banners = snapshot.checkouts
    .map((checkout) => bannerForCheckout(checkout, snapshot.newestSessionId))
    .filter(
      (banner): banner is TopupCheckoutBanner =>
        banner !== null && !dismissed.has(topupCheckoutBannerKey(banner))
    )
  for (const kind of RANKED_KINDS) {
    const banner = banners.find((candidate) => candidate.kind === kind)
    if (banner) return banner
  }
  return null
}
