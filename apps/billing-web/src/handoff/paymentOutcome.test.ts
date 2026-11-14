import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'

import type { HandoffState, TabMarker } from '@/handoff/handoffTab'
import {
  followPaymentOutcome,
  handoffTab,
  readHandoffState,
  readTabMarker,
  sessionTabStorage,
  writeHandoffState
} from '@/handoff/handoffTab'
import type { CheckingPayment } from '@/handoff/paymentOutcome'
import { readPaymentOutcome } from '@/session/billingWebClient'

const OUTCOME = 'https://testcloud.comfy.org/api/billing/ops/op-7/outcome'
const HANDOFF_KEY = 'comfy.billing-web.handoff.v1'
const BEARER = 'comfy-scoped-session-1'
const FIVE_MINUTES = 5 * 60_000

const CHECKING: CheckingPayment = {
  kind: 'ended',
  ending: 'payment_pending',
  reference: 'op-7',
  workspace: 'Studio',
  token: BEARER
}
type Ended = Extract<HandoffState, { kind: 'ended' }>

const COMPLETED: Ended = {
  kind: 'ended',
  ending: 'completed',
  workspace: 'Studio',
  reference: 'op-7'
}
const UNCONFIRMED: Ended = {
  kind: 'ended',
  ending: 'unconfirmed',
  reference: 'op-7'
}

function memoryMarker(): TabMarker {
  let value = ''
  return {
    read: () => value,
    write: (next) => {
      value = next
    }
  }
}

function openEndedTab(state: HandoffState | undefined) {
  handoffTab.value = state
  if (state) writeHandoffState(sessionTabStorage, state)
  const marker = memoryMarker()
  const stop = followPaymentOutcome({
    storage: sessionTabStorage,
    marker,
    readOutcome: readPaymentOutcome
  })
  onTestFinished(stop)
  return { marker, stop }
}

function heldAnswer() {
  let release: (answer: Response) => void = () => {}
  const answer = new Promise<Response>((resolve) => {
    release = resolve
  })
  return { answer, release: (response: Response) => release(response) }
}

const reports = (status: string) => () => Response.json({ status })
const refuses = (status: number, code: string) => () =>
  Response.json({ code, message: 'no' }, { status })
const passes = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const outcomeReads = () => fetchRequests(OUTCOME).length

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  handoffTab.value = undefined
})

describe('followPaymentOutcome', () => {
  it.for<{ name: string; answer: () => Response; ended: Ended }>([
    {
      name: 'Cloud reports the payment succeeded',
      answer: reports('succeeded'),
      ended: COMPLETED
    },
    {
      name: 'Cloud reports the payment failed, which does not rule out a charge',
      answer: reports('failed'),
      ended: UNCONFIRMED
    },
    {
      name: 'Cloud parked the payment for reconciliation',
      answer: reports('reconciliation_needed'),
      ended: UNCONFIRMED
    },
    {
      name: 'Cloud no longer honours the ended session',
      answer: refuses(401, 'INVALID_CREDENTIAL'),
      ended: UNCONFIRMED
    },
    {
      name: 'the billing handoff flag is off',
      answer: refuses(403, 'HANDOFF_DISABLED'),
      ended: UNCONFIRMED
    },
    {
      name: "the operation is not in the session's workspace",
      answer: refuses(404, 'NOT_FOUND'),
      ended: UNCONFIRMED
    }
  ])(
    'ends as $ended.ending once $name, drops the bearer and reads no more',
    async ({ answer, ended }) => {
      respondToFetch(OUTCOME, answer)
      const { marker } = openEndedTab(CHECKING)

      await passes(0)

      expect(handoffTab.value).toEqual(ended)
      expect(readHandoffState(sessionTabStorage)).toEqual(ended)
      expect(sessionStorage.getItem(HANDOFF_KEY)).not.toContain(BEARER)
      expect(readTabMarker(marker)).toBe(ended.ending)

      await passes(2 * FIVE_MINUTES)

      expect(outcomeReads()).toBe(1)
    }
  )

  it('keeps checking, and keeps the bearer for a reload, while Cloud calls the payment pending', async () => {
    respondToFetch(OUTCOME, reports('pending'))
    openEndedTab(CHECKING)

    await passes(60_000)

    expect(handoffTab.value).toEqual(CHECKING)
    expect(readHandoffState(sessionTabStorage)).toEqual(CHECKING)
  })

  it('shows the payment went through as soon as a later read says so', async () => {
    respondToFetch(OUTCOME, reports('succeeded'))
    respondToFetch(OUTCOME, reports('pending'), { times: 2 })
    openEndedTab(CHECKING)

    await passes(1_500)
    expect(handoffTab.value).toEqual(CHECKING)
    await passes(2_250)

    expect(handoffTab.value).toEqual(COMPLETED)
    expect(sessionStorage.getItem(HANDOFF_KEY)).not.toContain(BEARER)
  })

  it('reads at once, again after 1.5 seconds, and backs off to one read every 8 seconds', async () => {
    respondToFetch(OUTCOME, reports('pending'))
    openEndedTab(CHECKING)

    await passes(0)
    expect(outcomeReads()).toBe(1)
    await passes(1_499)
    expect(outcomeReads()).toBe(1)
    await passes(1)
    expect(outcomeReads()).toBe(2)
    await passes(2_250)
    expect(outcomeReads()).toBe(3)

    await passes(60_000)
    const readsAfterBackoff = outcomeReads()
    await passes(40_000)

    expect(outcomeReads() - readsAfterBackoff).toBe(5)
  })

  it('waits for a slow answer before it reads again', async () => {
    const slow = heldAnswer()
    respondToFetch(OUTCOME, reports('pending'))
    respondToFetch(OUTCOME, () => slow.answer, { times: 1 })
    openEndedTab(CHECKING)

    await passes(20_000)
    expect(outcomeReads()).toBe(1)

    slow.release(Response.json({ status: 'pending' }))
    await passes(1_500)

    expect(outcomeReads()).toBe(2)
  })

  it('stops checking a payment Cloud still calls pending after five minutes, as unconfirmed', async () => {
    respondToFetch(OUTCOME, reports('pending'))
    openEndedTab(CHECKING)

    await passes(FIVE_MINUTES - 1_000)
    expect(handoffTab.value).toEqual(CHECKING)
    await passes(9_000)

    expect(handoffTab.value).toEqual(UNCONFIRMED)
    expect(readHandoffState(sessionTabStorage)).toEqual(UNCONFIRMED)
    expect(sessionStorage.getItem(HANDOFF_KEY)).not.toContain(BEARER)
    const readsWhenItGaveUp = outcomeReads()
    await passes(FIVE_MINUTES)
    expect(outcomeReads()).toBe(readsWhenItGaveUp)
  })

  it.for<{ name: string; answer: () => Response | Promise<Response> }>([
    {
      name: 'server errors',
      answer: () => new Response(null, { status: 503 })
    },
    {
      name: 'a network that is down',
      answer: () => Promise.reject(new TypeError('offline'))
    },
    {
      name: 'answers it cannot read',
      answer: reports('refunded')
    }
  ])(
    'keeps checking through $name, and ends unconfirmed when they outlast five minutes',
    async ({ answer }) => {
      respondToFetch(OUTCOME, answer)
      openEndedTab(CHECKING)

      await passes(FIVE_MINUTES - 1_000)
      expect(handoffTab.value).toEqual(CHECKING)
      await passes(9_000)

      expect(handoffTab.value).toEqual(UNCONFIRMED)
      expect(sessionStorage.getItem(HANDOFF_KEY)).not.toContain(BEARER)
    }
  )

  it('lets the next answer decide after a read that failed', async () => {
    respondToFetch(OUTCOME, reports('succeeded'))
    respondToFetch(OUTCOME, () => new Response(null, { status: 500 }), {
      times: 1
    })
    openEndedTab(CHECKING)

    await passes(1_500)

    expect(handoffTab.value).toEqual(COMPLETED)
  })

  it('sends the kept bearer to the outcome route alone, without cookies', async () => {
    respondToFetch(OUTCOME, reports('pending'))
    openEndedTab(CHECKING)

    await passes(30_000)

    const sent = vi.mocked(fetch).mock.calls
    expect(new Set(sent.map(([url]) => url))).toEqual(new Set([OUTCOME]))
    expect(new Set(sent.map(([, init]) => init?.credentials))).toEqual(
      new Set(['omit'])
    )
    expect(
      new Set(
        fetchRequests().map(({ headers }) => headers.get('Authorization'))
      )
    ).toEqual(new Set([`Bearer ${BEARER}`]))
  })

  it('reads no more once stopped, and ignores an answer that was on its way', async () => {
    const onItsWay = heldAnswer()
    respondToFetch(OUTCOME, () => onItsWay.answer)
    const { stop } = openEndedTab(CHECKING)
    await passes(0)

    stop()
    onItsWay.release(Response.json({ status: 'succeeded' }))
    await passes(FIVE_MINUTES)

    expect(outcomeReads()).toBe(1)
    expect(handoffTab.value).toEqual(CHECKING)
    expect(readHandoffState(sessionTabStorage)).toEqual(CHECKING)
  })

  it('forgets the stored bearer when the ending cannot be stored over it', async () => {
    respondToFetch(OUTCOME, reports('succeeded'))
    handoffTab.value = CHECKING
    writeHandoffState(sessionTabStorage, CHECKING)
    onTestFinished(
      followPaymentOutcome({
        storage: {
          ...sessionTabStorage,
          setItem: () => {
            throw new DOMException('full', 'QuotaExceededError')
          }
        },
        marker: memoryMarker(),
        readOutcome: readPaymentOutcome
      })
    )

    await passes(0)

    expect(handoffTab.value).toEqual(COMPLETED)
    expect(sessionStorage.getItem(HANDOFF_KEY)).toBeNull()
  })

  it.for<{ name: string; state: HandoffState | undefined }>([
    { name: 'a tab that never held a handoff', state: undefined },
    {
      name: 'a live handoff session',
      state: {
        kind: 'session',
        session: {
          token: BEARER,
          expiresAt: Date.parse('2026-11-09T12:30:00Z'),
          userId: 'user-1',
          email: 'a@example.com',
          workspace: { id: 'ws-1', name: 'Studio', type: 'team' },
          role: 'owner'
        }
      }
    },
    {
      name: 'a tab that ended with no payment to check',
      state: { kind: 'ended', ending: 'link_unavailable' }
    },
    {
      name: 'a tab that already learned its payment went through',
      state: COMPLETED
    },
    {
      name: 'a tab an older build left checking, which kept no bearer',
      state: { kind: 'ended', ending: 'payment_pending', reference: 'op-7' }
    }
  ])('asks Cloud nothing for $name', async ({ state }) => {
    openEndedTab(state)

    await passes(2 * FIVE_MINUTES)

    expect(fetch).not.toHaveBeenCalled()
    expect(handoffTab.value).toEqual(state)
  })
})
