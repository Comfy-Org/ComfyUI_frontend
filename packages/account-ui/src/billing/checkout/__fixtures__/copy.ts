import type {
  CheckoutCopy,
  CheckoutInviteCopy,
  CheckoutSuccessCopy
} from '../checkoutCopy'
import type { CheckoutPlan } from '../checkoutQuote'

export const checkoutCopy: CheckoutCopy = {
  back: 'Back',
  usdPerMonth: 'USD / mo',
  billedMonthly: 'Billed monthly',
  billedYearly: (total) => `${total} Billed yearly`,
  eachMonthCreditsRefill: 'Each month credits refill to',
  eachYearCreditsRefill: 'Each year credits refill to',
  totalDueToday: 'Total due today',
  renewsAt: (amount, date) => `Renews at ${amount} on ${date}.`,
  renewsAtAmount: (amount) => `Renews at ${amount}.`,
  discount: { plan: 'Plan discount', promotion: 'Promo code' },
  promoCodePlaceholder: 'Promo code',
  applyPromoCode: 'Apply',
  reconciliationTitle: 'Payment received — confirmation pending',
  reconciliationDetail: 'Contact support with this operation ID:',
  authenticationFailedDetail: 'We could not complete payment verification.',
  pendingVerificationDetail: 'A payment you started earlier needs you.',
  completeVerification: 'Complete verification',
  cancelPaymentAndRetry: 'Cancel payment and try again',
  confirmPayment: 'Confirm your payment',
  startingToday: 'Starts today',
  parkedCheckoutDetail: 'Your earlier checkout is waiting for a card.',
  completePayment: 'Complete your payment',
  payAndSubscribe: 'Pay and subscribe',
  subscribeToPlan: (plan) => `Subscribe to ${plan}`,
  confirmUpgradeTitle: 'Confirm your upgrade',
  confirmChangeTitle: 'Review your scheduled change',
  switchesToday: 'Switches today',
  startsOn: (date) => `Starts ${date}`,
  creditsYoullGetToday: "Credits you'll get today",
  refillReplacesNote: 'Replaces your monthly refill.',
  afterThat: 'After that',
  creditsRefillMonthlyTo: 'Credits refill monthly to',
  billedEachMonth: (amount) => `${amount} billed each month.`,
  discountComposition: 'Discounts',
  quoteUnavailable: 'Unavailable',
  confirmUpgradeCta: 'Confirm upgrade',
  confirmChange: 'Confirm change',
  reactivation: {
    title: 'Reactivating your subscription',
    titleAnnual: 'Reactivating your subscription — full year billed today',
    upgradeBody:
      'Your {plan} was set to end on {date}. You will be charged {amount} today and renew on {nextDate}.',
    downgradeBody:
      'Your {plan} was set to end on {date}. Switching to {newPlan} renews on {nextDate}.',
    durationChangeBody:
      'Your {plan} was set to end on {date}. Annual billing charges {amount} today, renewing {nextDate}.',
    durationChangeBodyMonthly:
      'Your {plan} was set to end on {date}. Monthly billing charges {amount} today, renewing {nextDate}.',
    withoutRenewalDate: {
      upgradeBody:
        'Your {plan} was set to end on {date}. You will be charged {amount} today and renew.',
      downgradeBody:
        'Your {plan} was set to end on {date}. Switching to {newPlan} renews it.',
      durationChangeBody:
        'Your {plan} was set to end on {date}. Annual billing charges {amount} today and renews.',
      durationChangeBodyMonthly:
        'Your {plan} was set to end on {date}. Monthly billing charges {amount} today and renews.'
    },
    confirmButton: 'Confirm & reactivate',
    confirmButtonWithCharge: (amount) =>
      `Confirm & reactivate — ${amount} today`,
    checkboxLabel: (amount) => `I understand I'll be charged ${amount} today`
  },
  savedMethod: {
    savedPaymentMethod: 'Payment method',
    changePaymentMethod: 'Change',
    addNewPaymentMethod: 'Add new payment method',
    alipay: 'Alipay',
    selectLabel: 'Select payment method'
  },
  terms: {
    agreement: 'By continuing, you agree to the {terms} and {privacy}.',
    terms: 'Terms',
    privacyPolicy: 'Privacy Policy'
  },
  payment: {
    paymentMethod: 'Payment method',
    methodChoice: 'Handled by Stripe.',
    billingAddress: 'Billing address',
    alipayRenewalNote: 'Alipay renews too.',
    unavailable: 'Payment options are unavailable.',
    genericError: 'Error'
  }
}

export const successCopy: CheckoutSuccessCopy = {
  allSet: "You're all set",
  planUpdated: 'Your plan has been successfully updated.',
  receiptEmailed: 'A receipt has been emailed to you.',
  usdPerMonth: 'USD / mo',
  usdPerYear: 'USD / year',
  perMonth: '/ month',
  perYear: '/ year',
  promoApplied: (code) => `${code} applied.`,
  promoRenews: (amount, date) => `Renews at ${amount} on ${date}`,
  close: 'Close'
}

export const creatorPlan: CheckoutPlan = {
  name: 'Creator',
  monthlyPriceUsd: { monthly: 35, yearly: 28 },
  monthlyCredits: 7400,
  pricedByQuote: true
}

export const teamPlan: CheckoutPlan = {
  name: 'Team',
  monthlyPriceUsd: { monthly: 1330, yearly: 1330 },
  monthlyCredits: 147_700,
  pricedByQuote: false
}

export const inviteCopy: CheckoutInviteCopy = {
  title: 'Invite your team',
  subtext: 'You can also invite people later from Settings',
  placeholder: 'Enter emails separated by commas',
  sendInvites: 'Send invites',
  removeTag: 'Remove tag',
  invalidEmailCount: (count) => `${count} invalid email address(es)`,
  pendingInviteSingle: 'This person already has a pending invite',
  pendingInviteCount: (count) => `${count} already invited`,
  seatLimitExceeded: (max, overage) =>
    `This workspace is capped at ${max} members. Remove ${overage} to continue.`,
  invitedMessage: (emails, count) =>
    count === 1
      ? `An invite was sent to ${emails}`
      : `Invites were sent to ${emails}`,
  failedCount: (count) => `Couldn't send ${count} invite(s). Try again.`
}
