/** The dollar presets the Add credits dialog offers, in cents. */
export const ADD_CREDITS_PRESETS_CENTS: readonly number[] = [
  1000, 2500, 5000, 10000
]

export const ADD_CREDITS_DEFAULT_CENTS = 5000

/** Used only while the balance response omits `min_topup_cents` / `max_topup_cents`. */
export const ADD_CREDITS_FALLBACK_BOUNDS: AddCreditsBounds = {
  minCents: 500,
  maxCents: 1_000_000
}

export interface AddCreditsBounds {
  readonly minCents: number
  readonly maxCents: number
}

export type AddCreditsAmount =
  | { readonly kind: 'preset'; readonly cents: number }
  | { readonly kind: 'custom'; readonly input: string }

export type AddCreditsAmountError = 'below_min' | 'above_max' | 'whole_dollars'

export type AddCreditsAmountCheck =
  | { readonly status: 'empty' }
  | { readonly status: 'valid'; readonly cents: number }
  | { readonly status: 'invalid'; readonly error: AddCreditsAmountError }

const WHOLE_DOLLARS = /^(\d+)(?:\.0*)?$/
const DECIMAL = /^\d*\.?\d*$/

function checkCents(
  cents: number,
  bounds: AddCreditsBounds
): AddCreditsAmountCheck {
  if (cents < bounds.minCents) return { status: 'invalid', error: 'below_min' }
  if (cents > bounds.maxCents) return { status: 'invalid', error: 'above_max' }
  return { status: 'valid', cents }
}

/** Whole dollars only: `12`, `12.` and `12.00` are $12; anything else is an error, never rewritten. */
export function checkAddCreditsAmount(
  amount: AddCreditsAmount,
  bounds: AddCreditsBounds
): AddCreditsAmountCheck {
  if (amount.kind === 'preset') return checkCents(amount.cents, bounds)
  const input = amount.input.trim()
  if (input === '') return { status: 'empty' }
  const whole = WHOLE_DOLLARS.exec(input)
  if (whole) return checkCents(Number(whole[1]) * 100, bounds)
  if (!DECIMAL.test(input) || input === '.') {
    return { status: 'invalid', error: 'whole_dollars' }
  }
  const cents = Math.round(Number(input) * 100)
  return cents < bounds.minCents
    ? { status: 'invalid', error: 'below_min' }
    : { status: 'invalid', error: 'whole_dollars' }
}

/**
 * The amount the dialog opens with: the served `suggested_topup_amount_cents`
 * as a typed amount when it is above the $50 default, else the $50 preset.
 */
export function initialAddCreditsAmount(
  suggestedTopupCents: number | null | undefined
): AddCreditsAmount {
  if (
    suggestedTopupCents != null &&
    suggestedTopupCents > ADD_CREDITS_DEFAULT_CENTS &&
    suggestedTopupCents % 100 === 0
  ) {
    return { kind: 'custom', input: String(suggestedTopupCents / 100) }
  }
  return { kind: 'preset', cents: ADD_CREDITS_DEFAULT_CENTS }
}
