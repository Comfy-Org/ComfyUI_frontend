import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetServerFeatures } = vi.hoisted(() => ({
  mockGetServerFeatures: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    getServerFeatures: mockGetServerFeatures
  }
}))

import { resolveBillingFlagState } from './billingFlagState'

describe('resolveBillingFlagState', () => {
  beforeEach(() => {
    mockGetServerFeatures.mockReset()
  })

  it('reports the gated arm when the flag resolved true', () => {
    mockGetServerFeatures.mockReturnValue({ embedded_checked_enabled: true })

    expect(resolveBillingFlagState(true)).toBe('embedded_checkout_on')
  })

  it('reports the ungated arm once a flag map has actually arrived', () => {
    mockGetServerFeatures.mockReturnValue({ embedded_checked_enabled: false })

    expect(resolveBillingFlagState(false)).toBe('embedded_checkout_off')
  })

  // The flag only lands on the WebSocket handshake, so a false read before it
  // arrives is absence of an answer. Filing that as `off` would bank
  // pre-handshake traffic in the ungated arm of the rollout dashboard.
  it('reports unknown rather than off before any flag map has arrived', () => {
    mockGetServerFeatures.mockReturnValue({})

    expect(resolveBillingFlagState(false)).toBe('embedded_checkout_unknown')
  })
})
