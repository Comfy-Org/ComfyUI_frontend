import type {
  BillingOperationState,
  CapabilityDenialReason,
  PaymentReasonKey,
  PendingBillingOperation,
  TerminalBillingOperation
} from '@comfyorg/account-core/billing'

type ElementStatus = 'loading' | 'ready' | 'failed'

/** `none` means the read succeeded and the workspace has no saved method. */
type SavedStatus = 'loading' | 'ready' | 'none' | 'failed'

export type PaymentTab = 'saved' | 'new'

/** A saved-methods read as it arrives: how many methods, or that it failed. */
export type SavedArrival = number | 'failed'

/**
 * How capture collects the money. `on_file` is a plan change, which the
 * server charges to the method already on file, so no card form mounts.
 * `collect` is a new subscription: the Stripe element and the saved methods
 * load independently, and `tab` is only ever changed by the customer.
 */
type PaymentRail =
  | {
      readonly method: 'collect'
      readonly element: ElementStatus
      readonly saved: SavedStatus
      readonly tab: PaymentTab
    }
  | { readonly method: 'on_file' }

type CollectRail = Extract<PaymentRail, { method: 'collect' }>

/**
 * What the last Pay left above the button. `reconciling` is a Pay the server
 * refused because an operation is already pending or settled: no card, Pay
 * stays locked until the page re-reads that operation.
 */
export type InlineOutcome =
  | {
      readonly kind: 'declined'
      readonly reason?: PaymentReasonKey
      readonly operationId?: string
    }
  | { readonly kind: 'processing_error'; readonly operationId?: string }
  | { readonly kind: 'not_completed'; readonly operationId?: string }
  | { readonly kind: 'price_updated' }
  | { readonly kind: 'reconciling' }

/**
 * A plan set to end is kept only once the customer ticks the consent. Pay
 * stays live meanwhile: a click without the tick sends nothing and marks
 * the consent `invalid` until it is ticked.
 */
export type Reactivation = 'not_required' | 'required' | 'invalid' | 'confirmed'

/**
 * `sent` from the Pay click until the attempt settles, so an operation the
 * lifecycle publishes meanwhile is known to be this page's own.
 */
type Attempt = 'idle' | 'sent'

type Capture = {
  readonly kind: 'capture'
  readonly rail: PaymentRail
  readonly reactivation: Reactivation
  readonly attempt: Attempt
  readonly outcome?: InlineOutcome
}

/**
 * Who a settled payment belongs to, which decides what its screen may claim.
 * `started`: this page's own Pay, so it names the plan it quoted. `followed`:
 * money this page did not send, watched settle from a screen that promised
 * to update. `settled`: found already through on arrival or on a re-read.
 */
type Attribution = 'started' | 'followed' | 'settled'

/**
 * The full-page checkout, one state at a time. `resolving` renders the
 * capture skeleton, and carries a verdict a recovered operation already
 * reached so the capture it resolves into opens on that card. `waiting` is
 * money in flight that this page did not start: no fresh form until it
 * settles. `unconfirmed` is money whose outcome the page could not learn, so
 * it neither offers a form nor claims a charge. `terminal` is a payment that
 * went through.
 */
export type CheckoutPage =
  | { readonly kind: 'resolving'; readonly outcome?: InlineOutcome }
  | { readonly kind: 'refused'; readonly reason: CapabilityDenialReason }
  | { readonly kind: 'unavailable'; readonly code: string }
  | {
      readonly kind: 'plan_unavailable'
      readonly reason: PlanUnavailableReason
    }
  | Capture
  | { readonly kind: 'waiting'; readonly operation: PendingBillingOperation }
  | { readonly kind: 'unconfirmed'; readonly operationId: string }
  | {
      readonly kind: 'terminal'
      readonly operation?: TerminalBillingOperation
      readonly attribution: Attribution
    }

/** A verdict an operation reached on its own, for the card above Pay. */
export type OperationOutcome = Exclude<
  InlineOutcome,
  { kind: 'reconciling' | 'price_updated' }
>

export type CheckoutPageEvent =
  | { readonly type: 'refused'; readonly reason: CapabilityDenialReason }
  | { readonly type: 'unavailable'; readonly code: string }
  | { readonly type: 'planUnavailable'; readonly reason: PlanUnavailableReason }
  /** Try again on a checkout that could not load. */
  | { readonly type: 'retried' }
  | ({ readonly type: 'quoted'; readonly reactivation: boolean } & (
      | { readonly method: 'collect'; readonly saved: SavedArrival }
      | { readonly method: 'on_file' }
    ))
  | { readonly type: 'elementReady' }
  | { readonly type: 'elementFailed' }
  | { readonly type: 'elementRetried' }
  | { readonly type: 'savedLoaded'; readonly count: number }
  | { readonly type: 'savedFailed' }
  | { readonly type: 'savedRetried' }
  | { readonly type: 'tabSelected'; readonly tab: PaymentTab }
  | { readonly type: 'reactivationConfirmed'; readonly confirmed: boolean }
  /** Pay clicked while the keep-subscription consent was still unticked. */
  | { readonly type: 'consentMissing' }
  | { readonly type: 'paySubmitted' }
  | {
      readonly type: 'payFailed'
      readonly outcome: Exclude<InlineOutcome, { kind: 'reconciling' }>
    }
  | { readonly type: 'payRejectedAsPending' }
  /** The server activated the plan on the spot, issuing no operation to follow. */
  | { readonly type: 'paySettled' }
  /** A fresh quote after the server refused the old one; the form stays as typed. */
  | {
      readonly type: 'requoted'
      readonly reactivation: boolean
      readonly priceUpdated: boolean
    }
  /** The lifecycle's answer to "what is this workspace waiting on": an operation, or nothing. */
  | {
      readonly type: 'reconciled'
      readonly operation: BillingOperationState | undefined
      readonly outcome?: OperationOutcome
    }
  /** A followed operation moved; `outcome` is its verdict once it has one. */
  | {
      readonly type: 'operationChanged'
      readonly operation: BillingOperationState
      readonly outcome?: OperationOutcome
    }

export const RESOLVING: CheckoutPage = { kind: 'resolving' }

/**
 * Why no plan can be quoted for this link: the checkout's 404. `retired` is
 * a slug the catalog no longer has; the other two are links nobody could
 * have been sent, a team plan named without its commit stop, or a URL the
 * entry contract cannot read at all.
 */
export type PlanUnavailableReason =
  | 'retired'
  | 'team_stop_missing'
  | 'unreadable'

export const UNREADABLE_LINK: CheckoutPage = {
  kind: 'plan_unavailable',
  reason: 'unreadable'
}

/** The first read picks the tab: Saved whenever the tab row shows at all. */
function arrivedRail(saved: SavedArrival): CollectRail {
  if (saved === 'failed')
    return { method: 'collect', element: 'loading', saved, tab: 'saved' }
  return saved > 0
    ? { method: 'collect', element: 'loading', saved: 'ready', tab: 'saved' }
    : { method: 'collect', element: 'loading', saved: 'none', tab: 'new' }
}

function withCollect(
  page: CheckoutPage,
  change: (rail: CollectRail) => CollectRail | undefined
): CheckoutPage {
  if (page.kind !== 'capture' || page.rail.method !== 'collect') return page
  const next = change(page.rail)
  return next === undefined ? page : { ...page, rail: next }
}

/** Nothing about a Pay moves while the page re-reads the operation it collided with. */
function withCapture(
  page: CheckoutPage,
  change: (capture: Capture) => Capture | undefined
): CheckoutPage {
  if (page.kind !== 'capture' || page.outcome?.kind === 'reconciling')
    return page
  return change(page) ?? page
}

const reactivationOf = (required: boolean): Reactivation =>
  required ? 'required' : 'not_required'

/**
 * A re-read that finds nothing hides the tab row, so the one rail left is
 * Add new; with methods on file the customer's tab stands.
 */
function settledSaved(rail: CollectRail, count: number): CollectRail {
  return count > 0
    ? { ...rail, saved: 'ready' }
    : { ...rail, saved: 'none', tab: 'new' }
}

/** An event that means nothing in the current state returns it untouched. */
export function reduceCheckoutPage(
  page: CheckoutPage,
  event: CheckoutPageEvent
): CheckoutPage {
  if (isRailEvent(event)) return reduceRail(page, event)
  if (isAttemptEvent(event)) return reduceAttempt(page, event)
  switch (event.type) {
    case 'refused':
      return page.kind === 'resolving'
        ? { kind: 'refused', reason: event.reason }
        : page
    case 'unavailable':
      return page.kind === 'resolving'
        ? { kind: 'unavailable', code: event.code }
        : page
    case 'planUnavailable':
      return page.kind === 'resolving'
        ? { kind: 'plan_unavailable', reason: event.reason }
        : page
    case 'retried':
      return page.kind === 'unavailable' ? RESOLVING : page
    case 'quoted':
      return page.kind === 'resolving' ? arrived(page, event) : page
    case 'reconciled':
      return event.operation === undefined
        ? nothingPending(page)
        : followed(page, event.operation, event.outcome)
    case 'operationChanged':
      return followed(page, event.operation, event.outcome)
  }
}

function arrived(
  page: Extract<CheckoutPage, { kind: 'resolving' }>,
  event: Extract<CheckoutPageEvent, { type: 'quoted' }>
): Capture {
  return {
    kind: 'capture',
    rail:
      event.method === 'collect'
        ? arrivedRail(event.saved)
        : { method: 'on_file' },
    reactivation: reactivationOf(event.reactivation),
    attempt: 'idle',
    ...(page.outcome === undefined ? {} : { outcome: page.outcome })
  }
}

type RailEvent = Extract<
  CheckoutPageEvent,
  {
    type:
      | 'elementReady'
      | 'elementFailed'
      | 'elementRetried'
      | 'savedLoaded'
      | 'savedFailed'
      | 'savedRetried'
      | 'tabSelected'
  }
>

const RAIL_EVENT: Readonly<Record<RailEvent['type'], true>> = {
  elementReady: true,
  elementFailed: true,
  elementRetried: true,
  savedLoaded: true,
  savedFailed: true,
  savedRetried: true,
  tabSelected: true
}

function isRailEvent(event: CheckoutPageEvent): event is RailEvent {
  return Object.hasOwn(RAIL_EVENT, event.type)
}

/** The two collection rails and the tab the customer is on. */
function reduceRail(page: CheckoutPage, event: RailEvent): CheckoutPage {
  switch (event.type) {
    case 'elementReady':
      return withCollect(page, (rail) =>
        rail.element === 'loading' ? { ...rail, element: 'ready' } : undefined
      )
    case 'elementFailed':
      return withCollect(page, (rail) =>
        rail.element === 'failed' ? undefined : { ...rail, element: 'failed' }
      )
    case 'elementRetried':
      return withCollect(page, (rail) =>
        rail.element === 'failed' ? { ...rail, element: 'loading' } : undefined
      )
    case 'savedLoaded':
      return withCollect(page, (rail) =>
        rail.saved === 'loading' ? settledSaved(rail, event.count) : undefined
      )
    case 'savedFailed':
      return withCollect(page, (rail) =>
        rail.saved === 'loading' ? { ...rail, saved: 'failed' } : undefined
      )
    case 'savedRetried':
      return withCollect(page, (rail) =>
        rail.saved === 'failed' ? { ...rail, saved: 'loading' } : undefined
      )
    case 'tabSelected':
      return withCollect(page, (rail) =>
        rail.saved === 'none' || rail.tab === event.tab
          ? undefined
          : { ...rail, tab: event.tab }
      )
  }
}

type AttemptEvent = Extract<
  CheckoutPageEvent,
  {
    type:
      | 'reactivationConfirmed'
      | 'consentMissing'
      | 'paySubmitted'
      | 'payFailed'
      | 'payRejectedAsPending'
      | 'paySettled'
      | 'requoted'
  }
>

const ATTEMPT_EVENT: Readonly<Record<AttemptEvent['type'], true>> = {
  reactivationConfirmed: true,
  consentMissing: true,
  paySubmitted: true,
  payFailed: true,
  payRejectedAsPending: true,
  paySettled: true,
  requoted: true
}

function isAttemptEvent(event: CheckoutPageEvent): event is AttemptEvent {
  return Object.hasOwn(ATTEMPT_EVENT, event.type)
}

/** The Pay attempt and what it leaves above the button. */
function reduceAttempt(page: CheckoutPage, event: AttemptEvent): CheckoutPage {
  switch (event.type) {
    case 'reactivationConfirmed':
      return withCapture(page, (capture) =>
        capture.reactivation === 'not_required'
          ? undefined
          : {
              ...capture,
              reactivation: event.confirmed ? 'confirmed' : 'required'
            }
      )
    case 'consentMissing':
      return withCapture(page, (capture) =>
        needsConsent(capture)
          ? { ...capture, reactivation: 'invalid' }
          : undefined
      )
    case 'paySubmitted':
      return withCapture(page, ({ outcome: _cleared, ...capture }) => ({
        ...capture,
        attempt: 'sent'
      }))
    case 'payFailed':
      return withCapture(page, (capture) => ({
        ...capture,
        attempt: 'idle',
        outcome: event.outcome
      }))
    case 'payRejectedAsPending':
      return withCapture(page, (capture) => ({
        ...capture,
        attempt: 'idle',
        outcome: { kind: 'reconciling' }
      }))
    case 'paySettled':
      return page.kind === 'capture'
        ? { kind: 'terminal', attribution: 'started' }
        : page
    case 'requoted':
      return withCapture(page, ({ outcome: _replaced, ...capture }) => ({
        ...capture,
        attempt: 'idle',
        reactivation: reactivationOf(event.reactivation),
        ...(event.priceUpdated ? { outcome: { kind: 'price_updated' } } : {})
      }))
  }
}

/** Parked on a card is capture's business, not money in flight (rule 4). */
export function isParked(operation: BillingOperationState): boolean {
  return (
    operation.phase === 'pending' &&
    operation.serverPhase === 'awaiting_payment_method'
  )
}

/** In flight past card collection: an invoice, a challenge, or processing. */
function isInFlight(
  operation: BillingOperationState
): operation is PendingBillingOperation {
  return operation.phase === 'pending' && !isParked(operation)
}

/**
 * Nothing pending releases a Pay that was held for a re-read, and sends a
 * page that was watching money back to resolve a fresh capture.
 */
function nothingPending(page: CheckoutPage): CheckoutPage {
  switch (page.kind) {
    case 'waiting':
    case 'unconfirmed':
      return RESOLVING
    case 'capture':
      return page.outcome?.kind === 'reconciling'
        ? { ...page, attempt: 'idle', outcome: undefined }
        : page
    default:
      return page
  }
}

/**
 * What money in flight is waiting on, from the operation's own facts.
 * `received`: the charge went through and the plan is still landing.
 * `settling`: the bank is still capturing it, with nothing for the customer
 * to do. `verifying`: anything else, which the page is still checking.
 */
export type WaitingOn = 'verifying' | 'settling' | 'received'

export function waitingOn(operation: PendingBillingOperation): WaitingOn {
  if (operation.authenticationState === 'succeeded') return 'received'
  const settling =
    operation.authenticationState === 'processing' &&
    operation.serverPhase === 'in_progress' &&
    operation.actionUrl === undefined
  return settling ? 'settling' : 'verifying'
}

/** The server parked the operation for a human and cannot say whether money moved. */
const outcomeUnknown = (operation: BillingOperationState) =>
  operation.phase === 'reconciliation_needed'

const unconfirmed = (operation: { readonly id: string }): CheckoutPage => ({
  kind: 'unconfirmed',
  operationId: operation.id
})

/**
 * Where an operation the lifecycle follows puts the page. Money in flight
 * that this page did not send lands on `waiting`; a success lands on
 * `terminal`, attributed by who sent it. A failure of this page's own Pay is
 * left to that Pay's verdict, which also knows about re-quotes; any other
 * failure becomes the card above Pay. An outcome nobody can vouch for is
 * never a card and never a claim (rule 12).
 */
function followed(
  page: CheckoutPage,
  operation: BillingOperationState,
  outcome: OperationOutcome | undefined
): CheckoutPage {
  if (page.kind === 'terminal') return withSettled(page, operation)
  if (page.kind === 'resolving') return arrivedOn(page, operation, outcome)
  if (page.kind === 'capture')
    return followedInCapture(page, operation, outcome)
  if (page.kind === 'waiting' || page.kind === 'unconfirmed')
    return watched(page, operation, outcome)
  return page
}

/** A terminal reached before its operation arrived takes the operation's id. */
function withSettled(
  page: Extract<CheckoutPage, { kind: 'terminal' }>,
  operation: BillingOperationState
): CheckoutPage {
  return operation.phase === 'succeeded' && page.operation === undefined
    ? { ...page, operation }
    : page
}

/**
 * No form yet: a success is Already completed, money in flight is waiting,
 * and anything else (parked on a card, or settled short of success) resolves
 * a capture, opening on the verdict when there is one.
 */
function arrivedOn(
  page: Extract<CheckoutPage, { kind: 'resolving' }>,
  operation: BillingOperationState,
  outcome: OperationOutcome | undefined
): CheckoutPage {
  if (operation.phase === 'succeeded')
    return { kind: 'terminal', operation, attribution: 'settled' }
  if (isInFlight(operation)) return { kind: 'waiting', operation }
  if (outcomeUnknown(operation)) return unconfirmed(operation)
  return outcome === undefined ? page : { kind: 'resolving', outcome }
}

/**
 * Money this page is watching but did not send. A watch that lapses while
 * the page was still verifying becomes "we couldn't confirm"; one over a
 * charge it knows is settling or received keeps its screen while the page
 * re-reads. An unconfirmed page holds until a verdict arrives.
 */
function watched(
  page: Extract<CheckoutPage, { kind: 'waiting' | 'unconfirmed' }>,
  operation: BillingOperationState,
  outcome: OperationOutcome | undefined
): CheckoutPage {
  if (operation.phase === 'succeeded')
    return { kind: 'terminal', operation, attribution: attributionOf(page) }
  if (outcomeUnknown(operation)) return unconfirmed(operation)
  if (page.kind === 'unconfirmed')
    return isInFlight(operation) || operation.phase === 'timed_out'
      ? page
      : resolvingOn(outcome)
  if (operation.phase === 'timed_out')
    return waitingOn(page.operation) === 'verifying'
      ? unconfirmed(operation)
      : page
  if (isInFlight(operation)) return { kind: 'waiting', operation }
  return resolvingOn(outcome)
}

/**
 * A screen that promised to update on its own resolves to the success it
 * was waiting for. A first read that finds the money already through, which
 * the page only ever saw as verifying, was settled before it arrived.
 */
function attributionOf(
  page: Extract<CheckoutPage, { kind: 'waiting' | 'unconfirmed' }>
): Attribution {
  return page.kind === 'waiting' && waitingOn(page.operation) === 'verifying'
    ? 'settled'
    : 'followed'
}

const resolvingOn = (outcome: OperationOutcome | undefined): CheckoutPage =>
  outcome === undefined ? RESOLVING : { kind: 'resolving', outcome }

/**
 * This page's own Pay stays on the form until its verdict, which the Pay
 * itself reports; a success is attributed to it. An operation nobody here
 * sent takes the form away while in flight, or lands its verdict above Pay.
 */
function followedInCapture(
  page: Capture,
  operation: BillingOperationState,
  outcome: OperationOutcome | undefined
): CheckoutPage {
  const started = page.attempt === 'sent'
  if (operation.phase === 'succeeded')
    return {
      kind: 'terminal',
      operation,
      attribution: started ? 'started' : 'settled'
    }
  if (outcomeUnknown(operation)) return unconfirmed(operation)
  if (started) return page
  if (isInFlight(operation)) return { kind: 'waiting', operation }
  return outcome === undefined ? page : { ...page, attempt: 'idle', outcome }
}

/**
 * What the payment column shows for a rail. With no saved method to fall
 * back on, a failed element takes the whole column; otherwise each failure
 * stays inside its own tab and the other tab stays live.
 */
export type RailView =
  | { readonly kind: 'column_error' }
  | { readonly kind: 'on_file' }
  | { readonly kind: 'element_only'; readonly element: ElementStatus }
  | {
      readonly kind: 'tabs'
      readonly tab: PaymentTab
      readonly element: ElementStatus
      readonly saved: Exclude<SavedStatus, 'none'>
    }

export function railView(rail: PaymentRail): RailView {
  if (rail.method === 'on_file') return { kind: 'on_file' }
  const { element, saved, tab } = rail
  const savedDown = saved === 'none' || saved === 'failed'
  if (element === 'failed' && savedDown) return { kind: 'column_error' }
  if (saved === 'none') return { kind: 'element_only', element }
  return { kind: 'tabs', tab, element, saved }
}

/** The keep-subscription consent was asked for and is not ticked. */
export function needsConsent(page: CheckoutPage): boolean {
  return (
    page.kind === 'capture' &&
    (page.reactivation === 'required' || page.reactivation === 'invalid')
  )
}

/**
 * Pay waits for the quote and for the rail the customer is on: the ready
 * element on Add new, a loaded list on Saved, nothing for a method on file.
 * A collided Pay keeps it locked; an unticked consent does not, since Pay
 * is what marks it invalid.
 */
export function railAcceptsPay(page: CheckoutPage): boolean {
  if (page.kind !== 'capture') return false
  if (page.outcome?.kind === 'reconciling') return false
  const { rail } = page
  if (rail.method === 'on_file') return true
  return rail.tab === 'saved'
    ? rail.saved === 'ready'
    : rail.element === 'ready'
}
