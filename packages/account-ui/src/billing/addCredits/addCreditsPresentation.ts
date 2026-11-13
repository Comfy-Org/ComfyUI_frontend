import type {
  AddCreditsAmountView,
  AddCreditsBounds,
  AddCreditsCopyKey,
  AddCreditsNotice,
  AddCreditsPendingTopup,
  AddCreditsRefusal,
  AddCreditsTranslate,
  AutoTopUpDefaultCard,
  AutoTopUpFieldError,
  AutoTopUpFormValues,
  AutoTopUpRules
} from '@comfyorg/account-core/billing'
import {
  addCreditsWait,
  creditsToCents,
  smallestTopUpCents,
  amountErrorCopyKey,
  waitCopy
} from '@comfyorg/account-core/billing'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsQuote } from './useAddCreditsDialog'

type AddCreditsUiSlot =
  | 'root'
  | 'header'
  | 'title'
  | 'close'
  | 'body'
  | 'presets'
  | 'preset'
  | 'line'
  | 'field'
  | 'error'
  | 'notice'
  | 'summary'
  | 'footer'
  | 'primary'
  | 'secondary'

export type AddCreditsUi = Partial<Record<AddCreditsUiSlot, string>>

export const SUPPORT_TOKEN = '{support}'

export interface AddCreditsFormat {
  readonly money: (cents: number) => string
  readonly dollars: (cents: number) => string
  readonly count: (value: number) => string
}

export function addCreditsFormat(locale: string): AddCreditsFormat {
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const dollars = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
  const count = new Intl.NumberFormat(locale)
  return {
    money: (cents) => money.format(cents / 100),
    dollars: (cents) =>
      (cents % 100 === 0 ? dollars : money).format(cents / 100),
    count: (value) => count.format(value)
  }
}

export interface AddCreditsCopyContext {
  readonly translate: AddCreditsTranslate
  readonly format: AddCreditsFormat
}

export interface AddCreditsNoticeCopy {
  readonly tone: 'warning' | 'neutral'
  readonly title: string
  readonly body: readonly string[]
}

export interface AddCreditsFooterCopy {
  readonly credits: string
  readonly loading: boolean
  readonly detail: string
}

export function primaryActionClass(ui: AddCreditsUi): string {
  return cn(
    buttonVariants({ variant: 'inverted', size: 'lg' }),
    'shrink-0 no-underline',
    ui.primary
  )
}

export function footerBarClass(ui: AddCreditsUi, layout: string): string {
  return cn(
    'flex shrink-0 items-center gap-2 border-x-0 border-t border-b-0 border-solid px-4 py-4',
    layout,
    ui.footer
  )
}

export function amountErrorFor(
  view: AddCreditsAmountView,
  bounds: AddCreditsBounds,
  { translate, format }: AddCreditsCopyContext
): string | undefined {
  if (view.check.status !== 'invalid') return undefined
  const bound =
    view.check.error === 'below_min' ? bounds.minCents : bounds.maxCents
  return translate(amountErrorCopyKey(view.check.error), {
    amount: format.dollars(bound)
  })
}

const REFUSAL_COPY: Record<
  AddCreditsRefusal['kind'],
  readonly [AddCreditsCopyKey, AddCreditsCopyKey]
> = {
  checkout_failed: ['checkoutFailed.title', 'checkoutFailed.body'],
  not_allowed: ['notAllowed.title', 'notAllowed.body'],
  rate_limited: ['rateLimited.title', 'rateLimited.body'],
  purchases_paused: ['purchasesPaused.title', 'purchasesPaused.body']
}

const PENDING_COPY: Record<
  AddCreditsPendingTopup['kind'],
  readonly [AddCreditsCopyKey, AddCreditsCopyKey, AddCreditsCopyKey]
> = {
  processing: [
    'processing.title',
    'processing.titleNoAmount',
    'processing.body'
  ],
  needs_verification: [
    'needsVerification.title',
    'needsVerification.titleNoAmount',
    'needsVerification.body'
  ],
  not_verified: [
    'notVerified.title',
    'notVerified.titleNoAmount',
    'notVerified.body'
  ]
}

function splitSupport(text: string): string[] {
  return text.split(/(\{support\})/).filter((part) => part !== '')
}

function refusalBody(
  refusal: AddCreditsRefusal,
  bodyKey: AddCreditsCopyKey,
  translate: AddCreditsTranslate
): string {
  const support = SUPPORT_TOKEN
  if (refusal.kind !== 'rate_limited') return translate(bodyKey, { support })
  const wait = addCreditsWait(refusal.retryAfterSeconds)
  return wait.unit === 'later'
    ? translate('rateLimited.bodyNoWait', { support })
    : translate(bodyKey, { wait: waitCopy(wait, translate), support })
}

function refusalCopy(
  refusal: AddCreditsRefusal,
  translate: AddCreditsTranslate
): AddCreditsNoticeCopy {
  const [titleKey, bodyKey] = REFUSAL_COPY[refusal.kind]
  return {
    tone: 'warning',
    title: translate(titleKey),
    body: splitSupport(refusalBody(refusal, bodyKey, translate))
  }
}

function pendingCopy(
  pending: AddCreditsPendingTopup,
  { translate, format }: AddCreditsCopyContext
): AddCreditsNoticeCopy {
  const [withAmount, withoutAmount, bodyKey] = PENDING_COPY[pending.kind]
  return {
    tone: 'neutral',
    title:
      pending.amountCents === undefined
        ? translate(withoutAmount)
        : translate(withAmount, {
            amount: format.dollars(pending.amountCents)
          }),
    body: [translate(bodyKey)]
  }
}

export function noticeCopyFor(
  notice: AddCreditsNotice | undefined,
  context: AddCreditsCopyContext
): AddCreditsNoticeCopy | undefined {
  if (notice === undefined) return undefined
  return notice.kind === 'refusal'
    ? refusalCopy(notice.refusal, context.translate)
    : pendingCopy(notice, context)
}

export function noticeKindOf(
  notice: AddCreditsNotice | undefined
): string | undefined {
  return notice?.kind === 'refusal' ? notice.refusal.kind : notice?.kind
}

function quotedCredits(
  quote: AddCreditsQuote | undefined,
  { translate, format }: AddCreditsCopyContext
): string {
  if (quote?.status === 'ok') {
    return translate('credits', { credits: format.count(quote.credits) })
  }
  return quote?.status === 'unavailable'
    ? translate('creditsUnavailable')
    : translate('credits', { credits: 0 })
}

function notVerifiedFooter(
  cents: number | undefined,
  { translate, format }: AddCreditsCopyContext
): AddCreditsFooterCopy {
  return cents === undefined
    ? { credits: translate('notVerified.footer'), loading: false, detail: '' }
    : {
        credits: translate('notVerified.footerTitle', {
          amount: format.money(cents)
        }),
        loading: false,
        detail: translate('notVerified.footer')
      }
}

export function footerCopyFor(
  view: AddCreditsAmountView,
  quote: AddCreditsQuote | undefined,
  context: AddCreditsCopyContext
): AddCreditsFooterCopy {
  const { notice, amountCents } = view
  if (notice?.kind === 'not_verified') {
    return notVerifiedFooter(amountCents, context)
  }
  const verifying = notice?.kind === 'needs_verification'
  if (verifying && amountCents === undefined) {
    return { credits: '', loading: false, detail: '' }
  }
  return {
    credits: quotedCredits(quote, context),
    loading: quote?.status === 'loading',
    detail: context.translate(
      verifying ? 'needsVerification.footer' : 'paidAtCheckout',
      { amount: context.format.money(amountCents ?? 0) }
    )
  }
}

export function autoTopUpFieldMessage(
  error: AutoTopUpFieldError,
  values: AutoTopUpFormValues,
  rules: AutoTopUpRules,
  { translate, format }: AddCreditsCopyContext
): string {
  const threshold = values.thresholdCredits ?? 0
  switch (error) {
    case 'notWhole':
    case 'belowMinimum':
      return translate(`autoTopUp.fieldError.${error}`)
    case 'belowTarget':
      return translate('autoTopUp.fieldError.belowTarget', {
        minimum: format.count(threshold + rules.minReloadCredits),
        usd: format.dollars(Math.round(creditsToCents(rules.minReloadCredits)))
      })
    case 'aboveTarget': {
      const max = threshold + (rules.maxReloadCredits ?? 0)
      return translate('autoTopUp.fieldError.aboveTarget', {
        max: format.count(max),
        usd: format.dollars(Math.round(creditsToCents(max) / 100) * 100)
      })
    }
    case 'belowTopUp':
      return translate('autoTopUp.fieldError.belowTopUp', {
        amount: format.dollars(
          Math.ceil(
            (smallestTopUpCents(values, rules.maxReloadCredits) ?? 0) / 100
          ) * 100
        )
      })
    case 'invalid':
    case 'aboveCeiling':
      return translate('autoTopUp.invalid')
  }
}

export const BILLING_TOKEN = '{billing}'

export function autoTopUpConsentParts(
  defaultCard: AutoTopUpDefaultCard | null,
  max: string,
  translate: AddCreditsTranslate
): readonly string[] {
  const billing = BILLING_TOKEN
  const sentence =
    defaultCard === null
      ? translate('autoTopUp.consentNoCard', { billing, max })
      : translate('autoTopUp.consentDefaultCard', {
          billing,
          max,
          card: translate('autoTopUp.card', { ...defaultCard })
        })
  return sentence.split(/(\{billing\})/).filter((part) => part !== '')
}
