import { describe, expect, it, vi } from 'vitest'

import { MAX_HOLD_MS, useAgentSendGateStore } from './agentSendGateStore'

// There is deliberately no test asserting MAX_HOLD_MS exceeds the request
// window it has to outlast. It is derived from the same api.ts timeouts the
// window is built from, so raising one of those raises both sides and the
// assertion cannot fail; the only terms left are literals it would compare
// against literals. The derivation is the guard — see agentSendGateStore.ts.
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
})
