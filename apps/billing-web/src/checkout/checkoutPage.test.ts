import type { BillingOperationState } from '@comfyorg/account-core/billing'

import type {
  CheckoutPage,
  CheckoutPageEvent,
  OperationOutcome,
  PaymentTab,
  RailView,
  SavedArrival
} from '@/checkout/checkoutPage'
import {
  RESOLVING,
  isParked,
  railAcceptsPay,
  railView,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'
import {
  failedOperation,
  pendingOperation,
  succeededOperation
} from '@/test/fakeBillingClient'

const quoted = (
  saved: SavedArrival,
  reactivation = false
): CheckoutPageEvent => ({
  type: 'quoted',
  method: 'collect',
  saved,
  reactivation
})
const quotedOnFile: CheckoutPageEvent = {
  type: 'quoted',
  method: 'on_file',
  reactivation: false
}
const refused: CheckoutPageEvent = {
  type: 'refused',
  reason: 'not_workspace_owner'
}
const unavailable: CheckoutPageEvent = {
  type: 'unavailable',
  code: 'REQUEST_FAILED'
}
const ready: CheckoutPageEvent = { type: 'elementReady' }
const failed: CheckoutPageEvent = { type: 'elementFailed' }
const retried: CheckoutPageEvent = { type: 'elementRetried' }
const savedLoaded = (count: number): CheckoutPageEvent => ({
  type: 'savedLoaded',
  count
})
const savedFailed: CheckoutPageEvent = { type: 'savedFailed' }
const savedRetried: CheckoutPageEvent = { type: 'savedRetried' }
const select = (tab: PaymentTab): CheckoutPageEvent => ({
  type: 'tabSelected',
  tab
})

type Element = 'loading' | 'ready' | 'failed'
type Saved = 'loading' | 'ready' | 'none' | 'failed'

const collect = (
  element: Element,
  saved: Saved = 'none',
  tab: PaymentTab = saved === 'none' ? 'new' : 'saved'
): CheckoutPage => ({
  kind: 'capture',
  rail: { method: 'collect', element, saved, tab },
  reactivation: 'not_required',
  attempt: 'idle'
})

function replay(events: readonly CheckoutPageEvent[]): CheckoutPage {
  return events.reduce(reduceCheckoutPage, RESOLVING)
}

function viewOf(page: CheckoutPage): RailView | undefined {
  return page.kind === 'capture' ? railView(page.rail) : undefined
}

describe('reduceCheckoutPage', () => {
  it.for<{
    name: string
    events: CheckoutPageEvent[]
    expected: CheckoutPage
    pay: boolean
  }>([
    { name: 'nothing yet', events: [], expected: RESOLVING, pay: false },
    {
      name: 'a refusal',
      events: [refused],
      expected: { kind: 'refused', reason: 'not_workspace_owner' },
      pay: false
    },
    {
      name: 'a failed read',
      events: [unavailable],
      expected: { kind: 'unavailable', code: 'REQUEST_FAILED' },
      pay: false
    },
    {
      name: 'a quote with no saved method, on Add new',
      events: [quoted(0)],
      expected: collect('loading', 'none', 'new'),
      pay: false
    },
    {
      name: 'a quote with saved methods, on Saved, payable before the element',
      events: [quoted(2)],
      expected: collect('loading', 'ready', 'saved'),
      pay: true
    },
    {
      name: 'a quote whose saved read failed, on Saved',
      events: [quoted('failed')],
      expected: collect('loading', 'failed', 'saved'),
      pay: false
    },
    {
      name: 'a ready element with no saved method',
      events: [quoted(0), ready],
      expected: collect('ready'),
      pay: true
    },
    {
      name: 'Add new chosen before the element is ready',
      events: [quoted(1), select('new')],
      expected: collect('loading', 'ready', 'new'),
      pay: false
    },
    {
      name: 'Add new chosen once the element is ready',
      events: [quoted(1), ready, select('new')],
      expected: collect('ready', 'ready', 'new'),
      pay: true
    },
    {
      name: 'a quote charged to the method on file',
      events: [quotedOnFile],
      expected: {
        kind: 'capture',
        rail: { method: 'on_file' },
        reactivation: 'not_required',
        attempt: 'idle'
      },
      pay: true
    },
    {
      name: 'an element that fails after ready',
      events: [quoted(0), ready, failed],
      expected: collect('failed'),
      pay: false
    },
    {
      name: 'an element retry, which re-disables Pay until the remount is ready',
      events: [quoted(0), failed, retried],
      expected: collect('loading'),
      pay: false
    },
    {
      name: 'a saved retry, which stays on Saved while it reads',
      events: [quoted('failed'), savedRetried],
      expected: collect('loading', 'loading', 'saved'),
      pay: false
    },
    {
      name: 'a saved retry that finds methods',
      events: [quoted('failed'), savedRetried, savedLoaded(1)],
      expected: collect('loading', 'ready', 'saved'),
      pay: true
    },
    {
      name: 'a saved retry that fails again',
      events: [quoted('failed'), savedRetried, savedFailed],
      expected: collect('loading', 'failed', 'saved'),
      pay: false
    },
    {
      name: 'a saved retry that finds none, leaving only Add new',
      events: [quoted('failed'), ready, savedRetried, savedLoaded(0)],
      expected: collect('ready', 'none', 'new'),
      pay: true
    }
  ])('$name', ({ events, expected, pay }) => {
    const page = replay(events)

    expect(page).toEqual(expected)
    expect(railAcceptsPay(page)).toBe(pay)
  })

  it.for<{ name: string; from: CheckoutPage; event: CheckoutPageEvent }>([
    { name: 'element ready while resolving', from: RESOLVING, event: ready },
    { name: 'element failed while resolving', from: RESOLVING, event: failed },
    { name: 'retry while resolving', from: RESOLVING, event: retried },
    {
      name: 'a saved read while resolving',
      from: RESOLVING,
      event: savedLoaded(1)
    },
    { name: 'a tab while resolving', from: RESOLVING, event: select('new') },
    {
      name: 'a late quote after a refusal',
      from: replay([refused]),
      event: quoted(0)
    },
    {
      name: 'a late refusal after capture',
      from: collect('ready'),
      event: refused
    },
    {
      name: 'a late failure after capture',
      from: collect('loading'),
      event: unavailable
    },
    {
      name: 'a second quote during capture',
      from: collect('ready'),
      event: quotedOnFile
    },
    { name: 'retry of a live element', from: collect('ready'), event: retried },
    {
      name: 'ready from a failed element',
      from: collect('failed'),
      event: ready
    },
    {
      name: 'a saved retry of a live list',
      from: collect('ready', 'ready'),
      event: savedRetried
    },
    {
      name: 'a saved answer nobody asked for',
      from: collect('ready', 'failed'),
      event: savedLoaded(3)
    },
    {
      name: 'the Saved tab with nothing saved',
      from: collect('ready', 'none', 'new'),
      event: select('saved')
    },
    {
      name: 'the tab already selected',
      from: collect('ready', 'ready', 'saved'),
      event: select('saved')
    },
    {
      name: 'element events on a method on file',
      from: replay([quotedOnFile]),
      event: failed
    },
    {
      name: 'a tab on a method on file',
      from: replay([quotedOnFile]),
      event: select('new')
    }
  ])('ignores $name', ({ from, event }) => {
    expect(reduceCheckoutPage(from, event)).toBe(from)
  })

  it.for<{ tab: PaymentTab; event: CheckoutPageEvent }>([
    { tab: 'saved', event: failed },
    { tab: 'new', event: failed },
    { tab: 'saved', event: retried },
    { tab: 'new', event: retried },
    { tab: 'saved', event: ready },
    { tab: 'new', event: ready },
    { tab: 'saved', event: savedFailed },
    { tab: 'new', event: savedFailed },
    { tab: 'saved', event: savedRetried },
    { tab: 'new', event: savedRetried },
    { tab: 'saved', event: savedLoaded(2) },
    { tab: 'new', event: savedLoaded(2) }
  ])('never moves the customer off $tab on $event.type', ({ tab, event }) => {
    const pages = [
      collect('loading', 'loading', tab),
      collect('ready', 'ready', tab),
      collect('failed', 'failed', tab),
      collect('failed', 'ready', tab)
    ]
    for (const page of pages) {
      const next = reduceCheckoutPage(page, event)
      expect(next.kind === 'capture' && next.rail).toMatchObject({ tab })
    }
  })
})

describe('railView', () => {
  it.for<{
    name: string
    events: CheckoutPageEvent[]
    expected: RailView
  }>([
    {
      name: '360-4874: the element fails with no saved method',
      events: [quoted(0), failed],
      expected: { kind: 'column_error' }
    },
    {
      name: '368-15319: the element fails beside saved methods',
      events: [quoted(1), failed, select('new')],
      expected: {
        kind: 'tabs',
        tab: 'new',
        element: 'failed',
        saved: 'ready'
      }
    },
    {
      name: '368-15319: the element fails while the customer is on Saved',
      events: [quoted(1), failed],
      expected: {
        kind: 'tabs',
        tab: 'saved',
        element: 'failed',
        saved: 'ready'
      }
    },
    {
      name: '368-15401: the saved read fails beside a live element',
      events: [quoted('failed'), ready],
      expected: {
        kind: 'tabs',
        tab: 'saved',
        element: 'ready',
        saved: 'failed'
      }
    },
    {
      name: 'both rails down',
      events: [quoted('failed'), failed],
      expected: { kind: 'column_error' }
    },
    {
      name: 'no saved method, element live',
      events: [quoted(0), ready],
      expected: { kind: 'element_only', element: 'ready' }
    },
    {
      name: 'a method on file',
      events: [quotedOnFile],
      expected: { kind: 'on_file' }
    }
  ])('$name', ({ events, expected }) => {
    expect(viewOf(replay(events))).toEqual(expected)
  })
})

const submitted: CheckoutPageEvent = { type: 'paySubmitted' }
const declined: CheckoutPageEvent = {
  type: 'payFailed',
  outcome: {
    kind: 'declined',
    reason: 'insufficient_funds',
    operationId: 'op_1'
  }
}
const collided: CheckoutPageEvent = { type: 'payRejectedAsPending' }
const tick = (confirmed: boolean): CheckoutPageEvent => ({
  type: 'reactivationConfirmed',
  confirmed
})
const requoted = (
  reactivation: boolean,
  priceUpdated: boolean
): CheckoutPageEvent => ({ type: 'requoted', reactivation, priceUpdated })
const consentMissing: CheckoutPageEvent = { type: 'consentMissing' }

const live = [quoted(0), ready]

describe('reduceCheckoutPage after Pay', () => {
  it.for<{
    name: string
    events: CheckoutPageEvent[]
    outcome: string | undefined
    reactivation: string
    pay: boolean
  }>([
    {
      name: 'a decline leaves its card and Pay live',
      events: [...live, submitted, declined],
      outcome: 'declined',
      reactivation: 'not_required',
      pay: true
    },
    {
      name: 'the next Pay clears the card',
      events: [...live, submitted, declined, submitted],
      outcome: undefined,
      reactivation: 'not_required',
      pay: true
    },
    {
      name: 'a collided Pay locks the page for reconciliation',
      events: [...live, submitted, collided],
      outcome: 'reconciling',
      reactivation: 'not_required',
      pay: false
    },
    {
      name: 'an expired quote re-priced',
      events: [...live, submitted, requoted(false, true)],
      outcome: 'price_updated',
      reactivation: 'not_required',
      pay: true
    },
    {
      name: 'a quote that asks to keep the subscription leaves Pay live',
      events: [quoted(0, true), ready],
      outcome: undefined,
      reactivation: 'required',
      pay: true
    },
    {
      name: 'Pay without the tick marks the consent invalid, Pay still live',
      events: [quoted(0, true), ready, consentMissing],
      outcome: undefined,
      reactivation: 'invalid',
      pay: true
    },
    {
      name: 'ticking the consent clears the invalid state',
      events: [quoted(0, true), ready, consentMissing, tick(true)],
      outcome: undefined,
      reactivation: 'confirmed',
      pay: true
    },
    {
      name: 'unticking it asks again, without the red line',
      events: [quoted(0, true), ready, tick(true), tick(false)],
      outcome: undefined,
      reactivation: 'required',
      pay: true
    },
    {
      name: 'the server asking for consent re-asks unticked, even after a tick',
      events: [quoted(0, true), ready, tick(true), requoted(true, false)],
      outcome: undefined,
      reactivation: 'required',
      pay: true
    },
    {
      name: 'a Pay refused for consent nobody asked for',
      events: [...live, consentMissing],
      outcome: undefined,
      reactivation: 'not_required',
      pay: true
    },
    {
      name: 'a tick nobody was asked for',
      events: [...live, tick(true)],
      outcome: undefined,
      reactivation: 'not_required',
      pay: true
    }
  ])('$name', ({ events, outcome, reactivation, pay }) => {
    const page = replay(events)

    expect(page).toMatchObject({ kind: 'capture', reactivation })
    expect(page.kind === 'capture' && page.outcome?.kind).toBe(outcome)
    expect(railAcceptsPay(page)).toBe(pay)
  })

  it('never touches the payment element or the tab on a decline', () => {
    const before = replay([quoted(1), ready, select('new'), submitted])

    const after = reduceCheckoutPage(before, declined)

    expect(after.kind === 'capture' && after.rail).toBe(
      before.kind === 'capture' && before.rail
    )
  })

  it.for<{ name: string; event: CheckoutPageEvent }>([
    { name: 'a decline', event: declined },
    { name: 'a new Pay', event: submitted },
    { name: 'a re-quote', event: requoted(false, true) },
    { name: 'a reactivation tick', event: tick(true) },
    { name: 'a Pay without consent', event: consentMissing }
  ])('holds reconciliation against $name', ({ event }) => {
    const reconciling = replay([...live, submitted, collided])

    expect(reduceCheckoutPage(reconciling, event)).toBe(reconciling)
  })

  it.for<{ name: string; events: CheckoutPageEvent[] }>([
    { name: 'a live capture', events: live },
    { name: 'an unticked consent', events: [quoted(0, true), ready] }
  ])(
    'a failed re-quote takes $name to unavailable with no Pay',
    ({ events }) => {
      const page = replay([
        ...events,
        submitted,
        { type: 'requoteFailed', code: 'REQUEST_FAILED' }
      ])

      expect(page).toEqual({ kind: 'unavailable', code: 'REQUEST_FAILED' })
      expect(railAcceptsPay(page)).toBe(false)
    }
  )

  it.for<CheckoutPageEvent>([
    submitted,
    declined,
    collided,
    tick(true),
    { type: 'requoteFailed', code: 'REQUEST_FAILED' }
  ])('ignores $type outside capture', (event) => {
    expect(reduceCheckoutPage(RESOLVING, event)).toBe(RESOLVING)
  })
})

const parkedOperation = (): BillingOperationState => ({
  ...pendingOperation('op_parked'),
  serverPhase: 'awaiting_payment_method'
})
const reconciled = (
  operation: BillingOperationState | undefined,
  outcome?: OperationOutcome
): CheckoutPageEvent => ({
  type: 'reconciled',
  operation,
  ...(outcome === undefined ? {} : { outcome })
})
const changed = (
  operation: BillingOperationState,
  outcome?: OperationOutcome
): CheckoutPageEvent => ({
  type: 'operationChanged',
  operation,
  ...(outcome === undefined ? {} : { outcome })
})
const settledOnTheSpot: CheckoutPageEvent = { type: 'paySettled' }
const declinedElsewhere: OperationOutcome = {
  kind: 'declined',
  reason: 'card_declined',
  operationId: 'op_1'
}

describe('reduceCheckoutPage reconciliation', () => {
  it.for<{
    name: string
    events: CheckoutPageEvent[]
    expected: Partial<CheckoutPage>
    without?: 'outcome' | 'operation'
  }>([
    {
      name: 'nothing pending keeps resolving until the quote',
      events: [reconciled(undefined)],
      expected: { kind: 'resolving' }
    },
    {
      name: 'nothing pending then the quote is capture',
      events: [reconciled(undefined), quoted(0)],
      expected: { kind: 'capture', attempt: 'idle' }
    },
    {
      name: 'money in flight on mount is waiting, and the quote cannot open a form over it',
      events: [reconciled(pendingOperation()), quoted(0)],
      expected: { kind: 'waiting', operation: pendingOperation() }
    },
    {
      name: 'an operation parked on a card is capture (rule 4)',
      events: [reconciled(parkedOperation()), quoted(0)],
      expected: { kind: 'capture' },
      without: 'outcome'
    },
    {
      name: 'a parked operation whose last attempt declined opens capture on that card',
      events: [reconciled(parkedOperation(), declinedElsewhere), quoted(0)],
      expected: { kind: 'capture', outcome: declinedElsewhere }
    },
    {
      name: 'a success found on mount is Already completed, unattributed',
      events: [reconciled(succeededOperation()), quoted(0)],
      expected: {
        kind: 'terminal',
        operation: succeededOperation(),
        started: false
      }
    },
    {
      name: 'a failure found on mount opens capture on its card',
      events: [
        reconciled(failedOperation('card_declined'), declinedElsewhere),
        quoted(0)
      ],
      expected: { kind: 'capture', outcome: declinedElsewhere }
    },
    {
      name: 'a re-read from capture that finds money in flight leaves the form',
      events: [...live, reconciled(pendingOperation())],
      expected: { kind: 'waiting' }
    },
    {
      name: 'a re-read from capture that finds nothing changes nothing',
      events: [...live, reconciled(undefined)],
      expected: collect('ready')
    },
    {
      name: 'a collided Pay re-read as pending is waiting',
      events: [...live, submitted, collided, reconciled(pendingOperation())],
      expected: { kind: 'waiting' }
    },
    {
      name: 'a collided Pay re-read as settled is Already completed, unattributed',
      events: [...live, submitted, collided, reconciled(succeededOperation())],
      expected: { kind: 'terminal', started: false }
    },
    {
      name: 'a collided Pay re-read as nothing frees Pay again',
      events: [...live, submitted, collided, reconciled(undefined)],
      expected: collect('ready')
    },
    {
      name: 'waiting follows the operation as it moves',
      events: [
        reconciled(pendingOperation()),
        changed({ ...pendingOperation(), serverPhase: 'in_progress' })
      ],
      expected: {
        kind: 'waiting',
        operation: { ...pendingOperation(), serverPhase: 'in_progress' }
      }
    },
    {
      name: 'waiting settles into Already completed',
      events: [reconciled(pendingOperation()), changed(succeededOperation())],
      expected: { kind: 'terminal', started: false }
    },
    {
      name: 'waiting that declines resolves a fresh capture on that card',
      events: [
        reconciled(pendingOperation()),
        changed(failedOperation('card_declined'), declinedElsewhere)
      ],
      expected: { kind: 'resolving', outcome: declinedElsewhere }
    },
    {
      name: 'waiting whose operation turns out parked on a card resolves a capture (rule 4)',
      events: [reconciled(pendingOperation()), changed(parkedOperation())],
      expected: { kind: 'resolving' },
      without: 'outcome'
    },
    {
      name: 'waiting whose operation vanishes resolves again',
      events: [reconciled(pendingOperation()), reconciled(undefined)],
      expected: { kind: 'resolving' }
    },
    {
      name: "this page's own Pay stays on the form while its operation is pending",
      events: [...live, submitted, changed(pendingOperation())],
      expected: { kind: 'capture', attempt: 'sent' }
    },
    {
      name: "this page's own Pay succeeding is attributed",
      events: [...live, submitted, changed(succeededOperation())],
      expected: { kind: 'terminal', started: true }
    },
    {
      name: 'a plan the server activated with no operation is attributed',
      events: [...live, submitted, settledOnTheSpot],
      expected: { kind: 'terminal', started: true },
      without: 'operation'
    },
    {
      name: 'the operation arriving after the settle fills the terminal',
      events: [
        ...live,
        submitted,
        settledOnTheSpot,
        changed(succeededOperation())
      ],
      expected: {
        kind: 'terminal',
        started: true,
        operation: succeededOperation()
      }
    },
    {
      name: "this page's own failure is left to the Pay verdict",
      events: [
        ...live,
        submitted,
        changed(failedOperation('card_declined'), declinedElsewhere)
      ],
      expected: { kind: 'capture', attempt: 'sent' },
      without: 'outcome'
    },
    {
      name: 'a success after a decline card is still attributed to the retry',
      events: [
        ...live,
        submitted,
        declined,
        submitted,
        changed(succeededOperation())
      ],
      expected: { kind: 'terminal', started: true }
    },
    {
      name: 'a terminal is sticky against a later re-read',
      events: [
        reconciled(succeededOperation()),
        reconciled(undefined),
        reconciled(pendingOperation())
      ],
      expected: { kind: 'terminal', started: false }
    }
  ])('$name', ({ events, expected }) => {
    expect(replay(events)).toMatchObject(expected)
  })

  it.for<{
    name: string
    kind: 'refused' | 'unavailable'
    events: CheckoutPageEvent[]
  }>([
    { name: 'a refusal', kind: 'refused', events: [refused] },
    { name: 'an outage', kind: 'unavailable', events: [unavailable] }
  ])('leaves $name alone whatever the lifecycle says', ({ kind, events }) => {
    const page = replay(events)

    expect(reduceCheckoutPage(page, reconciled(pendingOperation()))).toBe(page)
    expect(reduceCheckoutPage(page, changed(succeededOperation()))).toBe(page)
    expect(page.kind).toBe(kind)
  })

  it.for<{ name: string; operation: BillingOperationState; parked: boolean }>([
    {
      name: 'awaiting a payment method',
      operation: parkedOperation(),
      parked: true
    },
    {
      name: 'pending with no phase',
      operation: pendingOperation(),
      parked: false
    },
    {
      name: 'awaiting an invoice',
      operation: {
        ...pendingOperation(),
        serverPhase: 'awaiting_invoice_payment'
      },
      parked: false
    },
    { name: 'succeeded', operation: succeededOperation(), parked: false }
  ])('$name is parked: $parked', ({ operation, parked }) => {
    expect(isParked(operation)).toBe(parked)
  })
})
