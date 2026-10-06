import type { RetentionOffer } from '@comfyorg/ingest-types'

export type RetentionOfferPhase =
  | 'offered'
  | 'accepting'
  | 'applied'
  | 'failed'
  | 'unconfirmed'

export type RetentionOfferEvent =
  | { type: 'acceptRequested' }
  | { type: 'applied' }
  | { type: 'rejected' }
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
      return phase === 'offered' || phase === 'unconfirmed'
        ? 'accepting'
        : phase
    case 'applied':
      return phase === 'accepting' ? 'applied' : phase
    case 'rejected':
      return phase === 'accepting' ? 'failed' : phase
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
      return 'dismissed'
  }
}

export function discountedAmount(
  amount: number,
  offer: Pick<RetentionOffer, 'percent_off'>
): number {
  return Math.round((amount * (100 - offer.percent_off)) / 100)
}
