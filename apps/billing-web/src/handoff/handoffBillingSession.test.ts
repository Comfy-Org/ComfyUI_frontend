import { createHandoffBillingSession } from '@/handoff/handoffBillingSession'
import type { HandoffState, TabStorage } from '@/handoff/handoffTab'
import {
  endHandoffAtExpiry,
  handoffTab,
  notePayment,
  readHandoffState,
  writeHandoffState
} from '@/handoff/handoffTab'
import type { PaymentEvent } from '@/handoff/paymentTrace'

const NOW = Date.parse('2026-11-09T12:00:00Z')

const live: HandoffState = {
  kind: 'session',
  session: {
    token: 'comfy-scoped-session-1',
    expiresAt: NOW + 30 * 60_000,
    userId: 'user-1',
    email: 'a@example.com',
    workspace: { id: 'ws-1', name: 'Studio', type: 'team' },
    role: 'owner'
  }
}

const HANDOFF_KEY = 'comfy.billing-web.handoff.v1'
const POINTER_KEY = 'comfy:billing:operation:user-1:ws-1'

function memoryStorage(): TabStorage & { block: () => void } {
  const items = new Map<string, string>()
  let blocked = false
  const open = () => {
    if (blocked) throw new DOMException('blocked', 'SecurityError')
    return items
  }
  return {
    getItem: (key) => open().get(key) ?? null,
    setItem: (key, value) => void open().set(key, value),
    removeItem: (key) => void open().delete(key),
    block: () => {
      blocked = true
    }
  }
}

function setup(state: HandoffState = live) {
  handoffTab.value = state
  const clock = { now: NOW }
  const storage = memoryStorage()
  writeHandoffState(storage, state)
  const session = createHandoffBillingSession(storage, () => clock.now)
  return { session, storage, clock }
}

function pointAt(storage: TabStorage, pointer: Record<string, unknown>) {
  storage.setItem(
    POINTER_KEY,
    JSON.stringify({
      operationId: 'op-1',
      presentation: 'embedded',
      attemptStartedAt: NOW,
      ...pointer
    })
  )
}

const SENT: PaymentEvent = { type: 'start_sent' }
const ANSWERED: PaymentEvent = { type: 'start_answered' }
const UNANSWERED: PaymentEvent = { type: 'start_unanswered' }
const succeeded = (operationId: string): PaymentEvent => ({
  type: 'payment_succeeded',
  operationId
})

function learn(storage: TabStorage, ...events: PaymentEvent[]) {
  events.forEach((event) => notePayment(storage, event))
}

const LINK: HandoffState = { kind: 'ended', ending: 'link_unavailable' }
const UNCONFIRMED: HandoffState = { kind: 'ended', ending: 'unconfirmed' }
const completed = (reference: string): HandoffState => ({
  kind: 'ended',
  ending: 'completed',
  workspace: 'Studio',
  reference
})

describe('createHandoffBillingSession', () => {
  it('hands the scoped session to billing calls for its own workspace', async () => {
    const { session } = setup()

    await expect(session.ensureFresh()).resolves.toMatchObject({
      status: 'ok',
      session: {
        token: 'comfy-scoped-session-1',
        uid: 'user-1',
        workspace: { id: 'ws-1' },
        role: 'owner'
      }
    })
    expect(session.getSnapshot().phase).toBe('authenticated')
  })

  it.for<{
    name: string
    arrange: (storage: TabStorage) => void
    ended: HandoffState
  }>([
    {
      name: 'a session that started no payment',
      arrange: () => {},
      ended: LINK
    },
    {
      name: 'a payment request still waiting for its answer',
      arrange: (storage) => learn(storage, SENT),
      ended: UNCONFIRMED
    },
    {
      name: 'a payment request that never got an answer',
      arrange: (storage) => learn(storage, SENT, UNANSWERED),
      ended: UNCONFIRMED
    },
    {
      name: 'a payment request Cloud refused, or one whose operation then failed',
      arrange: (storage) => learn(storage, SENT, ANSWERED),
      ended: LINK
    },
    {
      name: 'a payment this tab started and has not seen settle',
      arrange: (storage) => {
        learn(storage, SENT, ANSWERED)
        pointAt(storage, { kind: 'topup' })
      },
      ended: { kind: 'ended', ending: 'payment_pending', reference: 'op-1' }
    },
    {
      name: 'a payment the server parked for reconciliation',
      arrange: (storage) => {
        learn(storage, { type: 'payment_parked', operationId: 'op-1' })
        pointAt(storage, {
          kind: 'subscription',
          settled: 'reconciliation_needed',
          awaited: true
        })
      },
      ended: { kind: 'ended', ending: 'payment_pending', reference: 'op-1' }
    },
    {
      name: 'a parked payment a later, declined attempt replaced',
      arrange: (storage) =>
        learn(
          storage,
          { type: 'payment_parked', operationId: 'op-1' },
          SENT,
          ANSWERED
        ),
      ended: UNCONFIRMED
    },
    {
      name: 'a payment that succeeded',
      arrange: (storage) => {
        learn(storage, SENT, ANSWERED, succeeded('op-1'))
        pointAt(storage, { kind: 'topup', settled: 'succeeded' })
      },
      ended: completed('op-1')
    },
    {
      name: 'a succeeded payment only the pointer still records',
      arrange: (storage) =>
        pointAt(storage, { kind: 'subscription', settled: 'succeeded' }),
      ended: completed('op-1')
    },
    {
      name: 'a payment that succeeded before a later attempt was declined',
      arrange: (storage) =>
        learn(storage, SENT, ANSWERED, succeeded('op-1'), SENT, ANSWERED),
      ended: completed('op-1')
    },
    {
      name: 'a payment that succeeded before a later request went unanswered',
      arrange: (storage) => {
        learn(storage, SENT, ANSWERED, succeeded('op-1'), SENT, UNANSWERED)
        pointAt(storage, { kind: 'topup', settled: 'succeeded' })
      },
      ended: UNCONFIRMED
    },
    {
      name: 'the same succeeded payment read again after a request went unanswered',
      arrange: (storage) =>
        learn(storage, succeeded('op-1'), SENT, UNANSWERED, succeeded('op-1')),
      ended: UNCONFIRMED
    },
    {
      name: 'an unanswered request followed by a payment that succeeded',
      arrange: (storage) =>
        learn(storage, SENT, UNANSWERED, SENT, ANSWERED, succeeded('op-2')),
      ended: completed('op-2')
    },
    {
      name: 'an unanswered request followed by an attempt Cloud refused',
      arrange: (storage) => learn(storage, SENT, UNANSWERED, SENT, ANSWERED),
      ended: UNCONFIRMED
    },
    {
      name: 'a cancellation this tab sent, which is not a payment',
      arrange: (storage) =>
        pointAt(storage, { kind: 'cancel', settled: 'succeeded' }),
      ended: LINK
    },
    {
      name: 'a cancellation still settling, which is not a payment',
      arrange: (storage) => pointAt(storage, { kind: 'cancel' }),
      ended: LINK
    },
    {
      name: 'a kept subscription, which charges nothing',
      arrange: (storage) => {
        learn(
          storage,
          { type: 'subscription_kept', operationId: 'op-1' },
          succeeded('op-1')
        )
        pointAt(storage, { kind: 'subscription', settled: 'succeeded' })
      },
      ended: LINK
    },
    {
      name: 'a kept subscription still settling, which charges nothing',
      arrange: (storage) => {
        learn(storage, { type: 'subscription_kept', operationId: 'op-1' })
        pointAt(storage, { kind: 'subscription', awaited: true })
      },
      ended: LINK
    },
    {
      name: 'storage that no longer holds the session',
      arrange: (storage) => storage.removeItem(HANDOFF_KEY),
      ended: UNCONFIRMED
    }
  ])(
    'ends on $name as $ended.ending, and the end survives a reload',
    async ({ arrange, ended }) => {
      const { session, storage, clock } = setup()
      arrange(storage)
      clock.now = NOW + 31 * 60_000

      await expect(session.ensureFresh()).resolves.toEqual({
        status: 'error',
        code: 'NOT_AUTHENTICATED'
      })

      expect(handoffTab.value).toEqual(ended)
      expect(readHandoffState(storage)).toEqual(ended)
      expect(session.getSnapshot().phase).toBe('signed-out')
    }
  )

  it('ends as unconfirmed when storage can no longer be read, never as an unused link', async () => {
    const { session, storage, clock } = setup()
    storage.block()
    clock.now = NOW + 31 * 60_000

    await session.ensureFresh()

    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'unconfirmed' })
  })

  it('ends the handoff when the server refuses the session instead of minting another', async () => {
    const { session } = setup()
    const listener = vi.fn()
    session.subscribe(listener)

    await expect(session.remint()).resolves.toEqual({
      status: 'error',
      code: 'NOT_AUTHENTICATED'
    })

    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'link_unavailable'
    })
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'signed-out' })
    )
  })

  it('keeps how an ended handoff ended', async () => {
    const { session } = setup({ kind: 'ended', ending: 'link_unavailable' })

    await session.ensureFresh()
    await session.remint()

    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'link_unavailable'
    })
  })
})

describe('endHandoffAtExpiry', () => {
  it('ends the handoff when the session expires, with nothing calling billing', () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { storage, clock } = setup()
    onTestFinished(endHandoffAtExpiry(storage, () => clock.now))

    vi.advanceTimersByTime(30 * 60_000 - 1)
    expect(handoffTab.value).toEqual(live)
    vi.advanceTimersByTime(1)

    expect(handoffTab.value).toEqual({
      kind: 'ended',
      ending: 'link_unavailable'
    })
    expect(readHandoffState(storage)).toEqual({
      kind: 'ended',
      ending: 'link_unavailable'
    })
  })
})

describe('notePayment', () => {
  it('keeps what the tab learned for a reload, where a request still waiting for its answer can no longer get one', () => {
    const { storage } = setup()

    learn(storage, succeeded('op-1'), SENT)

    expect(handoffTab.value).toEqual({
      ...live,
      paid: 'op-1',
      unanswered: 'sent'
    })
    expect(readHandoffState(storage)).toEqual({
      ...live,
      paid: 'op-1',
      unanswered: 'lost'
    })
  })

  it('drops the stored session when what it learned cannot be stored, so a reload never reads it as unused', () => {
    const { storage } = setup()
    const unwritable: TabStorage = {
      ...storage,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      }
    }

    notePayment(unwritable, SENT)

    expect(handoffTab.value).toEqual({ ...live, unanswered: 'sent' })
    expect(readHandoffState(storage)).toBeUndefined()
  })

  it('leaves a tab that is not a handoff untouched', () => {
    handoffTab.value = undefined
    const storage = memoryStorage()

    notePayment(storage, SENT)

    expect(handoffTab.value).toBeUndefined()
    expect(storage.getItem(HANDOFF_KEY)).toBeNull()
  })
})
