import type { CheckoutPage, CheckoutPageEvent } from '@/checkout/checkoutPage'
import {
  RESOLVING,
  railAcceptsPay,
  reduceCheckoutPage
} from '@/checkout/checkoutPage'

const quotedCard: CheckoutPageEvent = { type: 'quoted', method: 'new_card' }
const quotedOnFile: CheckoutPageEvent = { type: 'quoted', method: 'on_file' }
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

const cardWith = (element: 'loading' | 'ready' | 'failed'): CheckoutPage => ({
  kind: 'capture',
  rail: { method: 'new_card', element }
})

function replay(events: readonly CheckoutPageEvent[]): CheckoutPage {
  return events.reduce(reduceCheckoutPage, RESOLVING)
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
      name: 'a quote for a new card',
      events: [quotedCard],
      expected: cardWith('loading'),
      pay: false
    },
    {
      name: 'a quote then a ready element',
      events: [quotedCard, ready],
      expected: cardWith('ready'),
      pay: true
    },
    {
      name: 'a quote charged to the method on file',
      events: [quotedOnFile],
      expected: { kind: 'capture', rail: { method: 'on_file' } },
      pay: true
    },
    {
      name: 'an element that fails before ready',
      events: [quotedCard, failed],
      expected: cardWith('failed'),
      pay: false
    },
    {
      name: 'an element that fails after ready',
      events: [quotedCard, ready, failed],
      expected: cardWith('failed'),
      pay: false
    },
    {
      name: 'a retry, which re-disables Pay until the remount is ready',
      events: [quotedCard, failed, retried],
      expected: cardWith('loading'),
      pay: false
    },
    {
      name: 'a retry that comes back ready',
      events: [quotedCard, failed, retried, ready],
      expected: cardWith('ready'),
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
      name: 'a late quote after a refusal',
      from: replay([refused]),
      event: quotedCard
    },
    {
      name: 'a late refusal after capture',
      from: cardWith('ready'),
      event: refused
    },
    {
      name: 'a late failure after capture',
      from: cardWith('loading'),
      event: unavailable
    },
    {
      name: 'a second quote during capture',
      from: cardWith('ready'),
      event: quotedOnFile
    },
    {
      name: 'retry of a live element',
      from: cardWith('ready'),
      event: retried
    },
    {
      name: 'ready from a failed element',
      from: cardWith('failed'),
      event: ready
    },
    {
      name: 'element events on a method on file',
      from: replay([quotedOnFile]),
      event: failed
    }
  ])('ignores $name', ({ from, event }) => {
    expect(reduceCheckoutPage(from, event)).toBe(from)
  })
})
