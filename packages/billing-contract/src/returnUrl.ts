/**
 * The trip back. Billing resolves a registered target to its environment's
 * destination and may append a coarse outcome plus an opaque reference; a
 * consumer reads both back and must work when neither is there, because a
 * customer can close the tab or arrive by bookmark at any point.
 */
import type { BillingEnvironment } from './contract.js'
import { ENTRY_PARAM_WORKSPACE } from './entryFields.js'
import { isContractIdentifier } from './identifiers.js'
import { resolveReturnTarget } from './returnTargets.js'
import { CONTRACT_PARSE_BASE, parseUrl } from './url.js'

/** Names are provisional; see `contract.ts`. */
const RETURN_PARAM_OUTCOME = 'billing_result'
const RETURN_PARAM_REFERENCE = 'billing_ref'

const BILLING_OUTCOMES = ['success', 'cancelled', 'pending'] as const

/**
 * Deliberately coarse. A consumer routes on it; the authoritative state of a
 * subscription is whatever the consumer's own next read of billing says.
 */
export type BillingOutcome = (typeof BILLING_OUTCOMES)[number]

function isBillingOutcome(value: string | null): value is BillingOutcome {
  return BILLING_OUTCOMES.some((outcome) => outcome === value)
}

export interface ReturnUrlInput {
  /** A `ReturnTarget`; see `BillingEntryInput.returnTo` for why it is wide. */
  readonly target: string
  readonly environment: BillingEnvironment
  /**
   * The workspace billing acted on, so the destination opens in it rather
   * than its own last-used one. Required so no caller drops it by omission;
   * `undefined` names none, and an id that is not opaque is dropped.
   */
  readonly workspace: string | undefined
  readonly result?: BillingOutcome
  /** An operation or correlation reference. Dropped when it is not opaque. */
  readonly reference?: string
}

export function buildReturnUrl(input: ReturnUrlInput): URL | undefined {
  const url = resolveReturnTarget(input.target, input.environment)
  if (!url) return undefined

  if (input.workspace !== undefined && isContractIdentifier(input.workspace))
    url.searchParams.set(ENTRY_PARAM_WORKSPACE, input.workspace)
  if (input.result !== undefined)
    url.searchParams.set(RETURN_PARAM_OUTCOME, input.result)
  if (input.reference !== undefined && isContractIdentifier(input.reference))
    url.searchParams.set(RETURN_PARAM_REFERENCE, input.reference)

  return url
}

export interface BillingReturn {
  readonly result?: BillingOutcome
  readonly reference?: string
}

export function parseReturnResult(url: string | URL): BillingReturn {
  const params = parseUrl(url, CONTRACT_PARSE_BASE)?.searchParams
  if (!params) return {}

  const result = params.get(RETURN_PARAM_OUTCOME)
  const reference = params.get(RETURN_PARAM_REFERENCE)
  return {
    ...(isBillingOutcome(result) ? { result } : {}),
    ...(reference !== null && isContractIdentifier(reference)
      ? { reference }
      : {})
  }
}
