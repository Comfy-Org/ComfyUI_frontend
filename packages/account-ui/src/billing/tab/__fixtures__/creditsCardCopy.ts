import type {
  CreditsBreakdownCopy,
  CreditsCardCopy
} from '#/billing/tab/creditsCardCopy'

const ADD_CREDITS_REASONS: Record<string, string> = {
  'credits.addCreditsRefusal.topupPurchasesPaused':
    "Buying credits isn't available right now. Try again later.",
  'credits.addCreditsRefusal.paymentPastDue':
    'Update your payment method to add credits.',
  'credits.addCreditsRefusal.unavailable':
    "Adding credits isn't available for this workspace right now."
}

export const creditsCardCopy: CreditsCardCopy = {
  title: 'Credits',
  rateInfo: 'About credits',
  rateTooltip: 'Credits pay for runs. 211 credits = $1.',
  available: 'Available',
  unavailable: "Couldn't load your balance.",
  tryAgain: 'Try again',
  overdrawn: (count, credits) =>
    credits === 1
      ? `Your runs used ${count} more credit than you had.`
      : `Your runs used ${count} more credits than you had.`,
  plan: 'Plan',
  planTooltip:
    'Credits included with your plan. They refill each billing period.',
  planOfPool: '{remaining} of {total}',
  planUsed: (percent) => `${percent}% used`,
  refills: (date) => `Refills ${date}`,
  refillsAfterPayment: 'Refills when the payment goes through',
  availableUntil: (date) => `Available until ${date}`,
  topUp: 'Top-up',
  topUpTooltip: "Credits you added. They're used once plan credits run out.",
  inUse: 'In use now',
  addCredits: 'Add credits',
  addCreditsReason: (reasonKey) => ADD_CREDITS_REASONS[reasonKey] ?? reasonKey
}

export const creditsBreakdownCopy: CreditsBreakdownCopy = {
  ...creditsCardCopy,
  planCredits: 'Plan credits',
  topUpCredits: 'Top-up credits'
}
