import type { AutoTopUpCardCopy } from '#/billing/tab/autoTopUpCardView'
import type {
  AutoTopUpMemberBlockCopy,
  AutoTopUpMemberView
} from '#/billing/tab/autoTopUpMemberView'

export const autoTopUpCardCopy: AutoTopUpCardCopy = {
  title: 'Auto top-up',
  unavailable: "Couldn't load auto top-up.",
  tryAgain: 'Try again',
  status: {
    failed: 'Failed',
    turnedOff: 'Turned off',
    off: 'Off',
    on: 'On',
    onHold: 'On hold',
    limitReached: 'Limit reached',
    maximumReached: 'Maximum reached'
  },
  actions: {
    addPaymentMethod: 'Add payment method',
    manage: 'Manage',
    turnOn: 'Turn on',
    updatePayment: 'Update payment'
  },
  failed:
    "Your charge didn't go through. Update your payment method or add credits manually.",
  turnedOff:
    'Turned off after 3 declined charges. Update your payment method, then turn it back on.',
  off: 'Refills credits when your balance runs low.',
  noPaymentMethod: 'Auto top-up needs a payment method. Add one to turn it on.',
  noDefaultPaymentMethod:
    'Auto top-up needs a default payment method. Set one to turn it on.',
  onHold: 'No default payment method. Set one to resume auto top-up.',
  rule: (target, threshold) =>
    `Tops up to ${target} credits when below ${threshold} credits.`,
  limit: (spent, limit) => `Monthly limit: ${spent} of ${limit} used`,
  limitTooltip: (date) => `Counts only auto top-up charges. Resets ${date}.`,
  limitTooltipNoDate: 'Counts only auto top-up charges.',
  paused: (date) => `Monthly limit reached. Resumes ${date}.`,
  pausedNoDate: 'Monthly limit reached.',
  pausedByRemainder: (date) =>
    `Next top-up would go over your monthly limit. Resumes ${date}.`,
  pausedByRemainderNoDate: 'Next top-up would go over your monthly limit.',
  maximumReached: (date) => `Monthly maximum reached. Resets ${date}.`,
  maximumReachedNoDate: 'Monthly maximum reached.'
}

const CONTACT = 'Contact a workspace owner to manage this.'

export const autoTopUpMemberBlockCopy: AutoTopUpMemberBlockCopy = {
  title: 'Auto top-up',
  body: `Credits can top up automatically when they run low. ${CONTACT}`,
  status: autoTopUpCardCopy.status,
  on: (target, threshold) =>
    `Tops up to ${target} credits when below ${threshold} credits. ${CONTACT}`,
  limitReached: (date) => `Monthly limit reached. Resets ${date}. ${CONTACT}`,
  limitReachedNoDate: `Monthly limit reached. ${CONTACT}`,
  maximumReached: (date) =>
    `Monthly maximum reached. Resets ${date}. ${CONTACT}`,
  maximumReachedNoDate: `Monthly maximum reached. ${CONTACT}`,
  failed: `The last top-up didn't go through. ${CONTACT}`,
  turnedOff: `Turned off after 3 declined charges. ${CONTACT}`,
  onHold: `Needs a default payment method. ${CONTACT}`
}

export const memberView = (
  overrides: Partial<AutoTopUpMemberView> = {}
): AutoTopUpMemberView => ({
  status: 'on',
  threshold_credits: 1000,
  target_credits: 6275,
  cycle_resets_at: '2026-11-28T00:00:00Z',
  monthly_budget_is_default: false,
  ...overrides
})
