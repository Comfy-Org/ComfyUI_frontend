import { describe, expect, it, vi } from 'vitest'

import { navigateToPlatformPlans } from '@/platform/billing/openPlatformPlans'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/refreshOnReturn'), () => ({
  registerRefreshOnReturn: vi.fn(() => vi.fn())
}))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}`
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
