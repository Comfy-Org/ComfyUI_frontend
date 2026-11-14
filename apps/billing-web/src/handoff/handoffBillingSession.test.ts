import { createHandoffBillingSession } from '@/handoff/handoffBillingSession'
import type { HandoffState, TabStorage } from '@/handoff/handoffTab'
import {
  endHandoffAtExpiry,
  handoffTab,
  noteChargeAttempt,
  readHandoffState,
  writeHandoffState
} from '@/handoff/handoffTab'

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
      name: 'a session that sent nothing that can charge',
      arrange: () => {},
      ended: { kind: 'ended', ending: 'link_unavailable' }
    },
    {
      name: 'a payment request that left no operation behind',
      arrange: (storage) => noteChargeAttempt(storage),
      ended: { kind: 'ended', ending: 'unconfirmed' }
    },
    {
      name: 'a payment this tab started and has not seen settle',
      arrange: (storage) => pointAt(storage, { kind: 'topup' }),
      ended: { kind: 'ended', ending: 'payment_pending', reference: 'op-1' }
    },
    {
      name: 'a payment the server parked for reconciliation',
      arrange: (storage) =>
        pointAt(storage, {
          kind: 'subscription',
          settled: 'reconciliation_needed',
          awaited: true
        }),
      ended: { kind: 'ended', ending: 'payment_pending', reference: 'op-1' }
    },
    {
      name: 'a payment that already succeeded',
      arrange: (storage) => {
        noteChargeAttempt(storage)
        pointAt(storage, { kind: 'topup', settled: 'succeeded' })
      },
      ended: {
        kind: 'ended',
        ending: 'completed',
        workspace: 'Studio',
        reference: 'op-1'
      }
    },
    {
      name: 'a payment started elsewhere that this tab watched succeed',
      arrange: (storage) =>
        pointAt(storage, { kind: 'subscription', settled: 'succeeded' }),
      ended: {
        kind: 'ended',
        ending: 'completed',
        workspace: 'Studio',
        reference: 'op-1'
      }
    },
    {
      name: 'a cancellation this tab sent, which is not a payment that went through',
      arrange: (storage) => {
        noteChargeAttempt(storage)
        pointAt(storage, { kind: 'cancel', settled: 'succeeded' })
      },
      ended: { kind: 'ended', ending: 'unconfirmed' }
    },
    {
      name: 'a cancellation started elsewhere, with nothing sent from this tab',
      arrange: (storage) => pointAt(storage, { kind: 'cancel' }),
      ended: { kind: 'ended', ending: 'link_unavailable' }
    },
    {
      name: 'storage that no longer holds the session',
      arrange: (storage) => storage.removeItem(HANDOFF_KEY),
      ended: { kind: 'ended', ending: 'unconfirmed' }
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

describe('noteChargeAttempt', () => {
  it('keeps the attempt on the session across a reload', () => {
    const { storage } = setup()

    noteChargeAttempt(storage)

    expect(handoffTab.value).toEqual({ ...live, chargeAttempted: true })
    expect(readHandoffState(storage)).toEqual({
      ...live,
      chargeAttempted: true
    })
  })

  it('drops the stored session when the attempt cannot be stored, so a reload never reads it as unused', () => {
    const { storage } = setup()
    const unwritable: TabStorage = {
      ...storage,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      }
    }

    noteChargeAttempt(unwritable)

    expect(handoffTab.value).toEqual({ ...live, chargeAttempted: true })
    expect(readHandoffState(storage)).toBeUndefined()
  })

  it('leaves a tab that is not a handoff untouched', () => {
    handoffTab.value = undefined
    const storage = memoryStorage()

    noteChargeAttempt(storage)

    expect(handoffTab.value).toBeUndefined()
    expect(storage.getItem(HANDOFF_KEY)).toBeNull()
  })
})
