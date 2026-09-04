import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockHasReceivedServerFeatureFlags } = vi.hoisted(() => ({
  mockHasReceivedServerFeatureFlags: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    hasReceivedServerFeatureFlags: mockHasReceivedServerFeatureFlags
  }
}))

import { resolveBillingFlagState } from './billingFlagState'

describe('resolveBillingFlagState', () => {
  beforeEach(() => {
    mockHasReceivedServerFeatureFlags.mockReset()
  })

  it('reports the gated arm when the flag resolved true', () => {
    mockHasReceivedServerFeatureFlags.mockReturnValue(true)

    expect(resolveBillingFlagState(true)).toBe('embedded_checkout_on')
  })

  it('reports the ungated arm once the handshake has been answered', () => {
    mockHasReceivedServerFeatureFlags.mockReturnValue(true)

    expect(resolveBillingFlagState(false)).toBe('embedded_checkout_off')
  })

  // The flag only lands on the WebSocket handshake, so a false read before it
  // arrives is absence of an answer. Filing that as `off` would bank
  // pre-handshake traffic in the ungated arm of the rollout dashboard.
  it('reports unknown rather than off before the handshake is answered', () => {
    mockHasReceivedServerFeatureFlags.mockReturnValue(false)

    expect(resolveBillingFlagState(false)).toBe('embedded_checkout_unknown')
  })
})
