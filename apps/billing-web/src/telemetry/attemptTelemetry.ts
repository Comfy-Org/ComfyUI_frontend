import type {
  BillingDeclineReason,
  BillingTelemetryEvent,
  BillingTelemetryFailure,
  SubscriptionCommandFailure,
  SubscriptionCommandOutcome,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'

/** How one command call ended, read the way the attempt's lifecycle needs it. */
export type AttemptOutcome =
  | { readonly kind: 'succeeded'; readonly billingOpId?: string }
  | {
      readonly kind: 'failed'
      readonly failure: BillingTelemetryFailure
      readonly billingOpId?: string
      readonly declineReason?: BillingDeclineReason
    }
  | { readonly kind: 'continued' }

export type SettledOutcome = Exclude<AttemptOutcome, { kind: 'continued' }>

type RefusalCode = Exclude<
  SubscriptionCommandFailure['code'],
  'REACTIVATION_CONFIRMATION_REQUIRED'
>

const CONTINUED: AttemptOutcome = { kind: 'continued' }

const UNEXPECTED_FAILURE: SettledOutcome = {
  kind: 'failed',
  failure: { failure_category: 'unknown' }
}

const API_REJECTED: BillingTelemetryFailure = {
  failure_category: 'api_rejected'
}

/** Undefined: the category depends on whether the request reached the server. */
const FAILURE_BY_REFUSAL: Record<
  RefusalCode,
  BillingTelemetryFailure | undefined
> = {
  INVALID_REQUEST: {
    failure_category: 'validation',
    error_code: 'invalid_request'
  },
  CONFLICTING_PAYMENT_METHOD: {
    failure_category: 'validation',
    error_code: 'conflicting_payment_method'
  },
  MISSING_PAYMENT_METHOD_URL: {
    failure_category: 'redirect',
    error_code: 'missing_payment_method_url'
  },
  QUOTE_STALE: { failure_category: 'api_rejected', error_code: 'quote_stale' },
  OPERATION_ALREADY_PENDING: {
    failure_category: 'api_rejected',
    error_code: 'operation_already_pending'
  },
  MALFORMED_RESPONSE: {
    failure_category: 'unknown',
    error_code: 'missing_checkout_response'
  },
  SUPERSEDED: { failure_category: 'stale_operation' },
  NO_ACTIVE_SUBSCRIPTION: API_REJECTED,
  ACCESS_DENIED: API_REJECTED,
  NOT_FOUND: API_REJECTED,
  CONFLICT: API_REJECTED,
  REQUEST_FAILED: undefined,
  NOT_AUTHENTICATED: undefined
}

function failureOfRefusal(
  code: RefusalCode,
  httpStatus: number | undefined
): BillingTelemetryFailure {
  return (
    FAILURE_BY_REFUSAL[code] ?? {
      failure_category: httpStatus === undefined ? 'network' : 'api_rejected'
    }
  )
}

function outcomeOfOperation({
  operation
}: SubscriptionCommandOutcome): SettledOutcome {
  if (operation === undefined) return { kind: 'succeeded' }
  const billingOpId = operation.id
  switch (operation.phase) {
    case 'succeeded':
      return { kind: 'succeeded', billingOpId }
    case 'failed':
      return {
        kind: 'failed',
        failure: { failure_category: 'provider_decline' },
        billingOpId,
        declineReason: operation.declineReason
      }
    case 'timed_out':
      return {
        kind: 'failed',
        failure: { failure_category: 'poll_timeout' },
        billingOpId
      }
    case 'reconciliation_needed':
      return {
        kind: 'failed',
        failure: { failure_category: 'reconciliation_needed' },
        billingOpId
      }
    case 'superseded':
      return {
        kind: 'failed',
        failure: { failure_category: 'stale_operation' },
        billingOpId
      }
  }
}

/**
 * The server's demand for the reactivation consent is the attempt carrying
 * on, not failing: the page asks and sends the same attempt again.
 */
export function outcomeOfCommandResult(
  result: SubscriptionCommandResult
): AttemptOutcome {
  if (result.status === 'ok') return outcomeOfOperation(result.value)
  if (result.code === 'REACTIVATION_CONFIRMATION_REQUIRED') return CONTINUED
  return {
    kind: 'failed',
    failure: failureOfRefusal(
      result.code,
      'httpStatus' in result ? result.httpStatus : undefined
    )
  }
}

export interface AttemptEvents<Context> {
  readonly begin: (context: Context) => readonly BillingTelemetryEvent[]
  readonly end: (
    context: Context,
    outcome: SettledOutcome,
    durationMs: number
  ) => BillingTelemetryEvent
}

interface OpenAttempt<Context> {
  readonly context: Context
  readonly startedAt: number
}

/**
 * One business attempt at a time: its start is reported once, immediately
 * before the command, and at most one terminal follows. A press while an
 * attempt is open joins it, and a result that continues it leaves it open.
 * Only an attempt this tab started ever gets a terminal.
 */
export function createAttemptTelemetry<Context>({
  events,
  track,
  now = Date.now
}: {
  readonly events: AttemptEvents<Context>
  readonly track: (event: BillingTelemetryEvent) => void
  readonly now?: () => number
}) {
  let open: OpenAttempt<Context> | undefined

  function begin(context: Context): OpenAttempt<Context> {
    const attempt = { context, startedAt: now() }
    open = attempt
    for (const event of events.begin(context)) track(event)
    return attempt
  }

  function end(attempt: OpenAttempt<Context>, outcome: SettledOutcome): void {
    if (open !== attempt) return
    open = undefined
    track(events.end(attempt.context, outcome, now() - attempt.startedAt))
  }

  async function run(
    context: Context,
    command: () => Promise<SubscriptionCommandResult>
  ): Promise<SubscriptionCommandResult> {
    const attempt = open ?? begin(context)
    let result: SubscriptionCommandResult
    try {
      result = await command()
    } catch (error) {
      end(attempt, UNEXPECTED_FAILURE)
      throw error
    }
    const outcome = outcomeOfCommandResult(result)
    if (outcome.kind !== 'continued') end(attempt, outcome)
    return result
  }

  return { run }
}
