import { afterEach, describe, expect, it, vi } from 'vitest'

import { setLocalBillingWebEnabled } from '@/platform/billing/localBillingWebEnabled'

import { usePlatformHandoff } from './usePlatformHandoff'

const distribution = vi.hoisted(() => ({ isCloud: false, isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

vi.mock(import('@comfyorg/telemetry'))

describe('usePlatformHandoff', () => {
  afterEach(() => {
    Object.assign(distribution, { isCloud: false, isDesktop: false })
    setLocalBillingWebEnabled(false)
  })

  it.for([
    {
      where: 'Cloud',
      cloud: true,
      desktop: false,
      flag: true,
      available: true
    },
    {
      where: 'local web, flag off',
      cloud: false,
      desktop: false,
      flag: false,
      available: true
    },
    {
      where: 'local web, flag on',
      cloud: false,
      desktop: false,
      flag: true,
      available: false
    },
    {
      where: 'Desktop, flag on',
      cloud: false,
      desktop: true,
      flag: true,
      available: true
    }
  ])(
    'is available $available on $where',
    ({ cloud, desktop, flag, available }) => {
      Object.assign(distribution, { isCloud: cloud, isDesktop: desktop })
      setLocalBillingWebEnabled(flag)

      const link = usePlatformHandoff('/profile/billing', { target: 'plans' })

      expect(link.available.value).toBe(available)
    }
  )
})
