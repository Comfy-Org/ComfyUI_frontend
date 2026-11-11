/** The Add credits dialog offering auto top-up after a top-up, and the offer being declined. */
export type AutoTopUpOfferBillingEvent = {
  operation: 'auto_top_up_offer'
  stage: 'viewed' | 'declined'
  outcome: 'pending'
}
