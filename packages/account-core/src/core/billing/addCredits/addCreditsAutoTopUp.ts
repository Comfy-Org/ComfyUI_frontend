import type { AutoReloadSettings, AutoTopUpSetup } from '@comfyorg/ingest-types'

import { canSetUpAutoTopUp } from '#/core/billing/billingTab/autoTopUpCard'

/** Credits bought per US dollar. */
export const CREDITS_PER_USD = 211

/** The threshold the auto top-up fields open with. */
export const AUTO_TOP_UP_STARTING_THRESHOLD_CREDITS = 1_000

/** The monthly limit the fields offer when the limit is switched on. */
export const AUTO_TOP_UP_STARTING_LIMIT_CENTS = 1_000_000

export interface AutoTopUpFormInput {
  readonly threshold: string
  readonly target: string
  readonly limit: string
  readonly limitOn: boolean
}

export interface AutoTopUpFormValues {
  readonly thresholdCredits: number | null
  readonly targetCredits: number | null
  readonly limitOn: boolean
  readonly budgetCents: number | null
}

/** The served rules from GET /api/billing/auto-reload the fields are checked against. */
export interface AutoTopUpRules {
  readonly minReloadCredits: number
  readonly maxReloadCredits: number | null
  readonly maxMonthlyBudgetCents: number
}

export type AutoTopUpField = 'threshold' | 'target' | 'limit'

export type AutoTopUpFieldError =
  | 'notWhole'
  | 'belowMinimum'
  | 'belowTarget'
  | 'aboveTarget'
  | 'invalid'
  | 'belowTopUp'
  | 'aboveCeiling'

export type AutoTopUpErrors = Partial<
  Record<AutoTopUpField, AutoTopUpFieldError>
>

/** The settings a top-up request carries to turn auto top-up on after it is paid (BE-25836). */
export interface AutoTopUpActivation {
  readonly threshold_credits: number
  readonly target_credits: number
  readonly monthly_budget_cents: number | null
}

const stripped = (raw: string) => raw.replace(/[,\s$]/g, '')

function parseWhole(raw: string): number | null {
  const text = stripped(raw)
  return /^\d+$/.test(text) ? Number(text) : null
}

function parseCents(raw: string): number | null {
  const text = stripped(raw)
  return /^\d+(\.\d{1,2})?$/.test(text) ? Math.round(Number(text) * 100) : null
}

export function creditsToCents(credits: number): number {
  return (credits * 100) / CREDITS_PER_USD
}

/** Fields prefilled with the starting threshold and a target that adds the credits just picked. */
export function startAutoTopUpForm(creditsPicked: number): AutoTopUpFormInput {
  return {
    threshold: String(AUTO_TOP_UP_STARTING_THRESHOLD_CREDITS),
    target: autoTopUpTargetFor(
      String(AUTO_TOP_UP_STARTING_THRESHOLD_CREDITS),
      creditsPicked
    ),
    limit: String(AUTO_TOP_UP_STARTING_LIMIT_CENTS / 100),
    limitOn: false
  }
}

export function autoTopUpTargetFor(
  threshold: string,
  creditsPicked: number
): string {
  const credits = parseWhole(threshold)
  return credits === null ? '' : String(credits + creditsPicked)
}

export function parseAutoTopUpForm(
  input: AutoTopUpFormInput
): AutoTopUpFormValues {
  return {
    thresholdCredits: parseWhole(input.threshold),
    targetCredits: parseWhole(input.target),
    limitOn: input.limitOn,
    budgetCents: input.limitOn ? parseCents(input.limit) : null
  }
}

/** What one top-up costs at least, as the server prices it when it checks the limit. */
export function smallestTopUpCents(
  { thresholdCredits, targetCredits }: AutoTopUpFormValues,
  maxReloadCredits: number | null
): number | null {
  if (
    thresholdCredits === null ||
    targetCredits === null ||
    targetCredits <= thresholdCredits
  ) {
    return null
  }
  const reload = targetCredits - thresholdCredits
  const atMaximum = maxReloadCredits !== null && reload >= maxReloadCredits
  return Math.ceil(creditsToCents(atMaximum ? reload : reload + 1))
}

/** The dollar value of target minus threshold, rounded down to the cent, so "at least" stays true. */
export function eachTopUpAtLeastCents({
  thresholdCredits,
  targetCredits
}: AutoTopUpFormValues): number | null {
  if (
    thresholdCredits === null ||
    targetCredits === null ||
    targetCredits <= thresholdCredits
  ) {
    return null
  }
  return Math.floor(creditsToCents(targetCredits - thresholdCredits))
}

function thresholdError(
  thresholdCredits: number | null
): AutoTopUpFieldError | undefined {
  if (thresholdCredits === null) return 'notWhole'
  return thresholdCredits < 1 ? 'belowMinimum' : undefined
}

function targetError(
  { thresholdCredits, targetCredits }: AutoTopUpFormValues,
  rules: AutoTopUpRules
): AutoTopUpFieldError | undefined {
  if (targetCredits === null || targetCredits < 1) return 'notWhole'
  if (thresholdCredits === null) return undefined
  if (targetCredits < thresholdCredits + rules.minReloadCredits) {
    return 'belowTarget'
  }
  return rules.maxReloadCredits !== null &&
    targetCredits > thresholdCredits + rules.maxReloadCredits
    ? 'aboveTarget'
    : undefined
}

function limitError(
  values: AutoTopUpFormValues,
  rules: AutoTopUpRules
): AutoTopUpFieldError | undefined {
  const { limitOn, budgetCents } = values
  if (!limitOn) return undefined
  if (budgetCents === null || budgetCents < 1) return 'invalid'
  if (budgetCents > rules.maxMonthlyBudgetCents) return 'aboveCeiling'
  const smallest = smallestTopUpCents(values, rules.maxReloadCredits)
  return smallest !== null && budgetCents < smallest ? 'belowTopUp' : undefined
}

export function validateAutoTopUp(
  values: AutoTopUpFormValues,
  rules: AutoTopUpRules
): AutoTopUpErrors {
  const threshold = thresholdError(values.thresholdCredits)
  const target = targetError(values, rules)
  const limit = limitError(values, rules)
  return {
    ...(threshold && { threshold }),
    ...(target && { target }),
    ...(limit && { limit })
  }
}

/** The request settings for valid values; null while any field is in error. */
export function autoTopUpActivationFor(
  values: AutoTopUpFormValues,
  rules: AutoTopUpRules
): AutoTopUpActivation | null {
  if (Object.keys(validateAutoTopUp(values, rules)).length > 0) return null
  if (values.thresholdCredits === null || values.targetCredits === null) {
    return null
  }
  return {
    threshold_credits: values.thresholdCredits,
    target_credits: values.targetCredits,
    monthly_budget_cents: values.budgetCents
  }
}

export function autoTopUpRulesFrom(
  settings: AutoReloadSettings
): AutoTopUpRules {
  return {
    minReloadCredits: settings.min_reload_credits,
    maxReloadCredits: settings.max_reload_credits,
    maxMonthlyBudgetCents: settings.max_monthly_budget_cents
  }
}

export interface AutoTopUpDefaultCard {
  readonly brand: string
  readonly last4: string
}

/** What the Add credits dialog offers for auto top-up, from served facts only. */
export type AddCreditsAutoTopUpOffer =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'on' }
  | {
      readonly kind: 'checkbox'
      readonly rules: AutoTopUpRules
      readonly defaultCard: AutoTopUpDefaultCard | null
    }

export interface AddCreditsAutoTopUpFacts {
  readonly autoTopUpEnabled: boolean
  readonly canManageAutoTopUp: boolean
  readonly setup: AutoTopUpSetup | null
  readonly settings: AutoReloadSettings | null
  readonly defaultCard: AutoTopUpDefaultCard | null
}

/** The checkbox for a manager whose served status is off, the on line while it is on, otherwise nothing. */
export function addCreditsAutoTopUpOffer(
  facts: AddCreditsAutoTopUpFacts
): AddCreditsAutoTopUpOffer {
  const { settings } = facts
  if (!facts.autoTopUpEnabled || settings === null) return { kind: 'hidden' }
  if (settings.status === 'on') return { kind: 'on' }
  if (settings.status !== 'off' || !canSetUpAutoTopUp(facts)) {
    return { kind: 'hidden' }
  }
  return {
    kind: 'checkbox',
    rules: autoTopUpRulesFrom(settings),
    defaultCard: facts.defaultCard
  }
}
