import { createHandoffBillingSession } from '@/handoff/handoffBillingSession'
import type { HandoffState, TabStorage } from '@/handoff/handoffTab'
import {
  endHandoffAtExpiry,
  handoffTab,
  readHandoffState
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

function memoryStorage(): TabStorage {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key)
  }
}

function setup(state: HandoffState = live) {
  handoffTab.value = state
  const clock = { now: NOW }
  const storage = memoryStorage()
  const session = createHandoffBillingSession(storage, () => clock.now)
  return { session, storage, clock }
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

  it('ends the handoff once the session expires, and the end survives a reload', async () => {
    const { session, storage, clock } = setup()
    clock.now = NOW + 31 * 60_000

    await expect(session.ensureFresh()).resolves.toEqual({
      status: 'error',
      code: 'NOT_AUTHENTICATED'
    })

    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'session_ended' })
    expect(readHandoffState(storage)).toEqual({
      kind: 'ended',
      ending: 'session_ended'
    })
    expect(session.getSnapshot().phase).toBe('signed-out')
  })

  it.for([
    {
      name: 'a payment this tab started and has not seen settle',
      pointer: { kind: 'topup' },
      ended: {
        kind: 'ended',
        ending: 'payment_pending',
        reference: 'op-1'
      }
    },
    {
      name: 'a payment that already settled',
      pointer: { kind: 'subscription', settled: 'succeeded' },
      ended: { kind: 'ended', ending: 'session_ended' }
    },
    {
      name: 'a cancellation',
      pointer: { kind: 'cancel' },
      ended: { kind: 'ended', ending: 'session_ended' }
    }
  ])('ends on $name as $ended.ending', async ({ pointer, ended }) => {
    const { session, storage, clock } = setup()
    storage.setItem(
      'comfy:billing:operation:user-1:ws-1',
      JSON.stringify({
        operationId: 'op-1',
        presentation: 'embedded',
        attemptStartedAt: NOW,
        ...pointer
      })
    )
    clock.now = NOW + 31 * 60_000

    await session.ensureFresh()

    expect(handoffTab.value).toEqual(ended)
    expect(readHandoffState(storage)).toEqual(ended)
  })

  it('ends the handoff when the server refuses the session instead of minting another', async () => {
    const { session } = setup()
    const listener = vi.fn()
    session.subscribe(listener)

    await expect(session.remint()).resolves.toEqual({
      status: 'error',
      code: 'NOT_AUTHENTICATED'
    })

    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'session_ended' })
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
    const { storage, clock } = setup()
    const stop = endHandoffAtExpiry(storage, () => clock.now)

    vi.advanceTimersByTime(30 * 60_000 - 1)
    expect(handoffTab.value).toEqual(live)
    vi.advanceTimersByTime(1)

    expect(handoffTab.value).toEqual({ kind: 'ended', ending: 'session_ended' })
    expect(readHandoffState(storage)).toEqual({
      kind: 'ended',
      ending: 'session_ended'
    })
    stop()
  })
})
