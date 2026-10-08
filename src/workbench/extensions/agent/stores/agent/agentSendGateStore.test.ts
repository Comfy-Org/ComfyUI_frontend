import { describe, expect, it, vi } from 'vitest'

import {
  AUTH_INIT_TIMEOUT_MS,
  FETCH_RESPONSE_HEADERS_TIMEOUT_MS
} from '@/scripts/apiTimeouts'

import { MAX_HOLD_MS, useAgentSendGateStore } from './agentSendGateStore'

/** `PREPARE_TIMEOUT_MS`, useAgentSession.ts — awaited inside the hold. */
const PREPARE_TIMEOUT_MS = 3_000
/** `DEFAULT_MINT_TIMEOUT_MS`, packages/account-core/src/core/session.ts. */
const MINT_TIMEOUT_MS = 15_000
/**
 * The backstop has to clear the bounded sum with room to spare, not merely
 * exceed it: `getAuthHeader()`, `shouldRemintCloudRequest()`'s dynamic import
 * and the unified-user wait ahead of the mint have no ceiling, and the mint
 * timeout is caller-configurable. A hand-summed 150s cleared the 148s sum by
 * two seconds and was still under a 163s remint path, so a retried POST could
 * arrive after the backstop had released a parked PUT — the PM-1660 ordering
 * the gate exists to prevent.
 */
const REQUIRED_HEADROOM_MS = 30_000

describe('agentSendGateStore', () => {
  it('counts overlapping holds and releases each one once', () => {
    const gate = useAgentSendGateStore()
    const first = gate.begin()
    gate.begin()

    first()
    first()

    expect(gate.isSending).toBe(true)
  })

  it('releases a hold that never settles, and not before the backstop', async () => {
    const gate = useAgentSendGateStore()
    gate.begin()

    await vi.advanceTimersByTimeAsync(MAX_HOLD_MS - 1)
    expect(gate.isSending).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    expect(gate.isSending).toBe(false)
  })

  // Reads the real api.ts bounds rather than restating them, so raising a
  // request timeout there fails here instead of silently shortening the hold
  // below the window it is supposed to outlast.
  it('outlasts every bounded wait between taking the hold and the POST arriving', () => {
    const boundedWindowMs =
      PREPARE_TIMEOUT_MS +
      AUTH_INIT_TIMEOUT_MS +
      // Spent twice: a 401 clears the first timer and arms a second for the
      // retry, with the remint in between.
      2 * FETCH_RESPONSE_HEADERS_TIMEOUT_MS +
      MINT_TIMEOUT_MS

    expect(MAX_HOLD_MS).toBeGreaterThanOrEqual(
      boundedWindowMs + REQUIRED_HEADROOM_MS
    )
  })
})
