import type {
  CheckoutPage,
  CheckoutPageEvent,
  PaymentTab,
  RailView,
  SavedArrival
} from '@/checkout/checkoutPage'
import {
  RESOLVING,
  railAcceptsPay,
  railView,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'

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
  reactivation: 'not_required'
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
        reactivation: 'not_required'
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

describe('reduceCheckoutPage after Pay', () => {
  const live = [quoted(0), ready]

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
      name: 'a quote that asks for reactivation locks Pay',
      events: [quoted(0, true), ready],
      outcome: undefined,
      reactivation: 'required',
      pay: false
    },
    {
      name: 'ticking the reactivation charge frees Pay',
      events: [quoted(0, true), ready, tick(true)],
      outcome: undefined,
      reactivation: 'confirmed',
      pay: true
    },
    {
      name: 'unticking it locks Pay again',
      events: [quoted(0, true), ready, tick(true), tick(false)],
      outcome: undefined,
      reactivation: 'required',
      pay: false
    },
    {
      name: 'the server asking for reactivation re-asks, even after a tick',
      events: [quoted(0, true), ready, tick(true), requoted(true, false)],
      outcome: undefined,
      reactivation: 'required',
      pay: false
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
    { name: 'a reactivation tick', event: tick(true) }
  ])('holds reconciliation against $name', ({ event }) => {
    const reconciling = replay([...live, submitted, collided])

    expect(reduceCheckoutPage(reconciling, event)).toBe(reconciling)
  })

  it.for<CheckoutPageEvent>([submitted, declined, collided, tick(true)])(
    'ignores $type outside capture',
    (event) => {
      expect(reduceCheckoutPage(RESOLVING, event)).toBe(RESOLVING)
    }
  )
})
