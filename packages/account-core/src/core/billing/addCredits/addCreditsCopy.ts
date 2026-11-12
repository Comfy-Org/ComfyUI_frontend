import type { AddCreditsAmountError } from './addCreditsAmount'
import type { AddCreditsWait } from './addCreditsRefusal'

/** One English table every host translates by key; `{support}` marks where the support link renders. */
export const ADD_CREDITS_COPY = {
  title: 'Add credits',
  customAmountLabel: 'Or enter an amount',
  'amountError.below_min': 'Minimum is {amount}.',
  'amountError.above_max':
    'The largest top-up is {amount}. Add more with another top-up.',
  'amountError.whole_dollars': 'Whole dollars only.',
  negativeBalance:
    'Your balance is −{credits} credits. This top-up covers that first.',
  'planLine.no_plan':
    "Buying credits doesn't start a Cloud plan. Subscribe to run workflows on Cloud.",
  'planLine.ended':
    "Buying credits doesn't restart your Cloud plan. Resubscribe to run workflows on Cloud.",
  'planLine.free_runs':
    "Buying credits doesn't start a Cloud plan. Subscribe to keep running workflows once your free runs are used.",
  credits: '{credits} credits',
  creditsUnavailable: '— credits',
  paidAtCheckout: '{amount}, paid at checkout',
  continue: 'Continue',
  opening: 'Opening…',
  'processing.title': 'A {amount} payment is still processing',
  'processing.titleNoAmount': 'A payment is still processing',
  'processing.body': 'No need to pay again.',
  'needsVerification.title': 'Your {amount} payment needs verification',
  'needsVerification.titleNoAmount': 'Your payment needs verification',
  'needsVerification.body':
    'Your bank is waiting for you to confirm it. Verify it to finish this top-up.',
  'needsVerification.footer': '{amount}, unverified',
  'needsVerification.action': 'Verify payment',
  'notVerified.title': "Your {amount} payment wasn't verified",
  'notVerified.titleNoAmount': "Your payment wasn't verified",
  'notVerified.body':
    "Your bank didn't confirm it. Try again later, or contact support.",
  'notVerified.footerTitle': '{amount} top-up',
  'notVerified.footer': 'Not verified',
  'notVerified.action': 'Contact support',
  'checkoutFailed.title': "Couldn't open checkout",
  'checkoutFailed.body': 'Nothing was charged. Try again.',
  'notAllowed.title': "You can't add credits right now",
  'notAllowed.body': 'Check Billing settings to see why.',
  'rateLimited.title': "You've hit the top-up limit for now",
  'rateLimited.body': 'Try again in {wait}, or {support}.',
  'rateLimited.bodyNoWait': 'Try again later, or {support}.',
  'purchasesPaused.title': "Buying credits isn't available right now",
  'purchasesPaused.body': 'Try again later, or {support}.',
  messageSupport: 'message support',
  'wait.minute': 'a minute',
  'wait.minutes': '{count} minutes',
  'wait.hour': 'an hour',
  'wait.hours': '{count} hours',
  'wait.day': 'a day',
  'wait.days': '{count} days',
  'opened.title': 'Checkout opened in a new tab',
  'opened.titleBrowser': 'Checkout opened in your browser',
  'opened.body':
    'Credits are added to this workspace as soon as your payment goes through.',
  'opened.credits': 'Credits',
  'opened.amount': 'Amount',
  'opened.reopen': 'Reopen checkout',
  close: 'Close',
  'blocked.title': "Checkout didn't open",
  'blocked.body':
    'Your browser blocked the new tab. Open checkout to finish paying.',
  'blocked.action': 'Open checkout',
  'autoTopUpOffer.body':
    'Buy credits automatically when you run low, so workflows and API calls keep running.',
  'autoTopUpOffer.setUp': 'Set up',
  'autoTopUpOffer.notNow': 'Not now',
  'autoTopUp.label': 'Turn on auto top-up',
  'autoTopUp.body':
    'Buy credits automatically when you run low, so workflows keep running.',
  'autoTopUp.threshold': 'When credits drop below',
  'autoTopUp.thresholdHint': 'Counts plan credits and credits you’ve bought.',
  'autoTopUp.target': 'Top up to',
  'autoTopUp.targetHint': '{target} credits. Each top-up is at least {amount}.',
  'autoTopUp.limit': 'Monthly limit',
  'autoTopUp.limitOff':
    'Up to {max} a month, the maximum. Turn on to set a lower limit.',
  'autoTopUp.limitHint': 'Most you can set here: {max} a month.',
  'autoTopUp.consentNoCard':
    'Top-ups are charged to the card you pay with at checkout, up to {max} a month. Turn this off anytime in {billing}.',
  'autoTopUp.consentDefaultCard':
    'Top-ups are charged to your default card, {card}, up to {max} a month. Turn this off anytime in {billing}.',
  'autoTopUp.card': '{brand} ···· {last4}',
  'autoTopUp.billing': 'Billing',
  'autoTopUp.invalid': 'Enter a valid value.',
  'autoTopUp.fieldError.notWhole': 'Enter a whole number of credits.',
  'autoTopUp.fieldError.belowMinimum': 'Must be at least 1 credit.',
  'autoTopUp.fieldError.belowTarget':
    'Must be at least {minimum} credits, about {usd} above your threshold.',
  'autoTopUp.fieldError.aboveTarget':
    'Can’t be more than {max} credits (about {usd}).',
  'autoTopUp.fieldError.belowTopUp':
    'Can’t cover one top-up. Set at least {amount}.',
  'autoTopUp.isOn': 'Auto top-up is on.',
  'autoTopUp.manage': 'Manage',
  'autoTopUpOn.title': 'Auto top-up is on',
  'autoTopUpOn.summary': 'Below {threshold} credits, tops up to {target}.',
  'autoTopUpOn.limit': 'Up to {limit} a month.',
  'autoTopUpOn.noLimit': 'No monthly limit.',
  'autoTopUpOn.done': 'Done',
  'autoTopUpFailed.title': "Auto top-up didn't turn on",
  'autoTopUpFailed.body':
    'Your credits were added. Set up auto top-up in Billing to try again.'
} as const satisfies Record<string, string>

export type AddCreditsCopyKey = keyof typeof ADD_CREDITS_COPY

/** The surface-only plan line a host passes in from its served plan state. */
export type AddCreditsPlanLine = 'no_plan' | 'ended' | 'free_runs'

export type AddCreditsCopyParams = Readonly<Record<string, string | number>>

/** The host's translator; the default fills the English table. */
export type AddCreditsTranslate = (
  key: AddCreditsCopyKey,
  params?: AddCreditsCopyParams
) => string

export const translateAddCreditsDefault: AddCreditsTranslate = (
  key,
  params = {}
) =>
  ADD_CREDITS_COPY[key].replace(/\{(\w+)\}/g, (token, name: string) =>
    name in params ? String(params[name]) : token
  )

export function amountErrorCopyKey(
  error: AddCreditsAmountError
): AddCreditsCopyKey {
  return `amountError.${error}`
}

const WAIT_KEYS = {
  minute: ['wait.minute', 'wait.minutes'],
  hour: ['wait.hour', 'wait.hours'],
  day: ['wait.day', 'wait.days']
} as const satisfies Record<
  Exclude<AddCreditsWait['unit'], 'later'>,
  readonly [AddCreditsCopyKey, AddCreditsCopyKey]
>

export function waitCopy(
  wait: Exclude<AddCreditsWait, { readonly unit: 'later' }>,
  translate: AddCreditsTranslate
): string {
  const [one, many] = WAIT_KEYS[wait.unit]
  return wait.count === 1
    ? translate(one)
    : translate(many, { count: wait.count })
}
