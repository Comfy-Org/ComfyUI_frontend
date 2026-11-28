/**
 * The query shape of an entry URL, in one table so the builder and the parser
 * cannot drift apart: a field is written and read under the same name, and a
 * value that fails the shared charset reports the same code on both sides.
 * The one exception is `promo`: the parser carries an unreadable one apart
 * rather than refusing the link, because it only prefills a field.
 */

/** Names are provisional; see `contract.ts`. */
export const ENTRY_PARAM_PRODUCT = 'product'
export const ENTRY_PARAM_RETURN_TO = 'return_to'
/** Also what a return URL names the billed workspace under. */
export const ENTRY_PARAM_WORKSPACE = 'workspace'
/** The unfinished operation a checkout link resumes. */
export const ENTRY_PARAM_OPERATION = 'operation'
/** Outside the table below: a source off the shared list is dropped, never an error. */
export const ENTRY_PARAM_SOURCE = 'source'

export type OptionalEntryKey =
  | 'plan'
  | 'correlationId'
  | 'workspaceId'
  | 'teamCreditStopId'
  | 'promotionCode'
  | 'operationId'
  | 'purchaseId'

export type InvalidIdentifierCode =
  | 'INVALID_PLAN'
  | 'INVALID_CORRELATION_ID'
  | 'INVALID_WORKSPACE_ID'
  | 'INVALID_TEAM_CREDIT_STOP_ID'
  | 'INVALID_PROMOTION_CODE'
  | 'INVALID_OPERATION_ID'
  | 'INVALID_PURCHASE_ID'

interface OptionalEntryField {
  readonly key: OptionalEntryKey
  readonly param: string
  readonly code: InvalidIdentifierCode
}

export const OPTIONAL_ENTRY_FIELDS: readonly OptionalEntryField[] = [
  { key: 'plan', param: 'plan', code: 'INVALID_PLAN' },
  {
    key: 'correlationId',
    param: 'correlation_id',
    code: 'INVALID_CORRELATION_ID'
  },
  {
    key: 'workspaceId',
    param: ENTRY_PARAM_WORKSPACE,
    code: 'INVALID_WORKSPACE_ID'
  },
  {
    key: 'teamCreditStopId',
    param: 'team_credit_stop_id',
    code: 'INVALID_TEAM_CREDIT_STOP_ID'
  },
  /** Prefills checkout's promo field; billing applies it only on the customer's Apply. */
  { key: 'promotionCode', param: 'promo', code: 'INVALID_PROMOTION_CODE' },
  /** An unfinished operation checkout resumes instead of whatever the status reports pending. */
  {
    key: 'operationId',
    param: ENTRY_PARAM_OPERATION,
    code: 'INVALID_OPERATION_ID'
  },
  /** The server-owned purchase a top-up pays; every Pay on the page goes through it. */
  { key: 'purchaseId', param: 'purchase', code: 'INVALID_PURCHASE_ID' }
]

export type OptionalEntryValues = {
  readonly [K in OptionalEntryKey]?: string
}

/**
 * The credit amount a top-up link asks for, in whole cents. It is the
 * customer's chosen quantity, not a price: billing quotes the credits it
 * buys from the server.
 */
export const ENTRY_PARAM_AMOUNT = 'amount_cents'

/** At most $9,999,999.99; the server applies its own limits on top. */
const MAX_AMOUNT_CENTS = 999_999_999

const WHOLE_CENTS = /^[1-9][0-9]{0,8}$/

export function isEntryAmountCents(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT_CENTS
}

export function readEntryAmountCents(raw: string): number | undefined {
  return WHOLE_CENTS.test(raw) ? Number(raw) : undefined
}

/** The auto top-up a top-up link asks to turn on with its payment; a choice, not a price or an authorization. */
export interface EntryAutoTopUp {
  readonly thresholdCredits: number
  readonly targetCredits: number
  /** Absent is no monthly limit of the customer's own. */
  readonly monthlyBudgetCents?: number
}

const AUTO_TOP_UP_PARAMS = {
  thresholdCredits: 'auto_top_up_threshold_credits',
  targetCredits: 'auto_top_up_target_credits',
  monthlyBudgetCents: 'auto_top_up_monthly_budget_cents'
} as const

export function isEntryAutoTopUp(value: EntryAutoTopUp): boolean {
  return (
    isEntryAmountCents(value.thresholdCredits) &&
    isEntryAmountCents(value.targetCredits) &&
    (value.monthlyBudgetCents === undefined ||
      isEntryAmountCents(value.monthlyBudgetCents))
  )
}

export function writeEntryAutoTopUp(
  params: URLSearchParams,
  value: EntryAutoTopUp
): void {
  params.set(
    AUTO_TOP_UP_PARAMS.thresholdCredits,
    String(value.thresholdCredits)
  )
  params.set(AUTO_TOP_UP_PARAMS.targetCredits, String(value.targetCredits))
  if (value.monthlyBudgetCents !== undefined)
    params.set(
      AUTO_TOP_UP_PARAMS.monthlyBudgetCents,
      String(value.monthlyBudgetCents)
    )
}

type EntryAutoTopUpRead =
  | { readonly status: 'absent' }
  | { readonly status: 'ok'; readonly value: EntryAutoTopUp }
  | { readonly status: 'invalid' }

/** Any one of the three parameters asks for auto top-up, so all present ones must read. */
export function readEntryAutoTopUp(
  params: URLSearchParams
): EntryAutoTopUpRead {
  const threshold = params.get(AUTO_TOP_UP_PARAMS.thresholdCredits)
  const target = params.get(AUTO_TOP_UP_PARAMS.targetCredits)
  const budget = params.get(AUTO_TOP_UP_PARAMS.monthlyBudgetCents)
  if (threshold === null && target === null && budget === null)
    return { status: 'absent' }
  const thresholdCredits =
    threshold === null ? undefined : readEntryAmountCents(threshold)
  const targetCredits =
    target === null ? undefined : readEntryAmountCents(target)
  const monthlyBudgetCents =
    budget === null ? undefined : readEntryAmountCents(budget)
  if (
    thresholdCredits === undefined ||
    targetCredits === undefined ||
    (budget !== null && monthlyBudgetCents === undefined)
  )
    return { status: 'invalid' }
  return {
    status: 'ok',
    value: {
      thresholdCredits,
      targetCredits,
      ...(monthlyBudgetCents === undefined ? {} : { monthlyBudgetCents })
    }
  }
}
