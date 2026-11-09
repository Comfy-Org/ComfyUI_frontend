import { describe, expect, it, vi } from 'vitest'

import {
  navigateToPlatformPlans,
  platformPlansLink
} from '@/platform/billing/openPlatformPlans'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/refreshOnReturn'), () => ({
  registerRefreshOnReturn: vi.fn(() => vi.fn())
}))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, _correlationId?: string, source?: string) =>
    source
      ? `https://platform.test${path}?source=${source}`
      : `https://platform.test${path}`
}))

describe('navigateToPlatformPlans', () => {
  it('arms a billing re-read before leaving, so a restored page does not show stale billing', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })

    navigateToPlatformPlans()

    expect(registerRefreshOnReturn).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith(
      'https://platform.test/profile/billing/plans'
    )
    expect(
      vi.mocked(registerRefreshOnReturn).mock.invocationCallOrder[0]
    ).toBeLessThan(assign.mock.invocationCallOrder[0])
  })
})

describe('the paywall the person saw', () => {
  it('rides the same-tab Plans navigation as the source', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })

    navigateToPlatformPlans('subscribe_to_run')

    expect(assign).toHaveBeenCalledWith(
      'https://platform.test/profile/billing/plans?source=subscribe_to_run'
    )
  })

  it('rides the Plans link a person follows as the source', () => {
    expect(platformPlansLink('free_tier_quota').href).toBe(
      'https://platform.test/profile/billing/plans?source=free_tier_quota'
    )
  })

  it('stays off the Plans link when the caller knows none', () => {
    expect(platformPlansLink().href).toBe(
      'https://platform.test/profile/billing/plans'
    )
  })
})
