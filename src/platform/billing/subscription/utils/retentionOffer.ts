import type { RetentionOffer } from '@comfyorg/ingest-types'

export type RetentionOfferPhase =
  | 'offered'
  | 'accepting'
  | 'applied'
  | 'failed'
  | 'declined'
  | 'expired'
  | 'unconfirmed'

export type RetentionOfferEvent =
  | { type: 'acceptRequested' }
  | { type: 'applied' }
  | { type: 'rejected' }
  | { type: 'declined' }
  | { type: 'expired' }
  | { type: 'unconfirmed' }

export type RetentionOfferOutcome =
  | 'retained'
  | 'continueToCancel'
  | 'pending'
  | 'dismissed'

export function reduceRetentionOffer(
  phase: RetentionOfferPhase,
  event: RetentionOfferEvent
): RetentionOfferPhase {
  switch (event.type) {
    case 'acceptRequested':
      return phase === 'offered' ||
        phase === 'failed' ||
        phase === 'unconfirmed'
        ? 'accepting'
        : phase
    case 'applied':
      return phase === 'accepting' ? 'applied' : phase
    case 'rejected':
      return phase === 'accepting' ? 'failed' : phase
    case 'declined':
      return phase === 'accepting' ? 'declined' : phase
    case 'expired':
      return phase === 'offered' || phase === 'accepting' ? 'expired' : phase
    case 'unconfirmed':
      return phase === 'accepting' ? 'unconfirmed' : phase
  }
}

export function outcomeOnClose(
  phase: RetentionOfferPhase
): RetentionOfferOutcome {
  switch (phase) {
    case 'applied':
      return 'retained'
    case 'accepting':
    case 'unconfirmed':
      return 'pending'
    case 'offered':
    case 'failed':
    case 'declined':
    case 'expired':
      return 'dismissed'
  }
}

export function discountedAmount(
  amount: number,
  offer: Pick<RetentionOffer, 'percent_off'>
): number {
  return Math.round((amount * (100 - offer.percent_off)) / 100)
}

export function fullPriceRenewal(periodEnd: number, months: number): Date {
  const start = new Date(periodEnd * 1000)
  const renewal = new Date(start)
  renewal.setUTCDate(1)
  renewal.setUTCMonth(start.getUTCMonth() + months)
  const lastDayOfMonth = new Date(
    Date.UTC(renewal.getUTCFullYear(), renewal.getUTCMonth() + 1, 0)
  ).getUTCDate()
  renewal.setUTCDate(Math.min(start.getUTCDate(), lastDayOfMonth))
  return renewal
}
