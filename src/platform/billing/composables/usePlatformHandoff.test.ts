import { useTelemetry } from '@comfyorg/telemetry'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openPlatformBillingHandoff } from '@/platform/billing/localBillingHandoff'
import { setLocalBillingWebEnabled } from '@/platform/billing/localBillingWebEnabled'

import {
  usePlatformBillingLink,
  usePlatformHandoff
} from './usePlatformHandoff'

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
vi.mock(import('@/platform/billing/localBillingHandoff'))

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

describe('usePlatformBillingLink', () => {
  afterEach(() => {
    Object.assign(distribution, { isCloud: false, isDesktop: false })
    setLocalBillingWebEnabled(false)
  })

  const opened = {
    operation: 'platform_handoff',
    stage: 'opened',
    outcome: 'pending',
    correlation_id: expect.any(String),
    target: 'auto_top_up',
    action: 'manage'
  }

  function manageLink() {
    return usePlatformBillingLink('/profile/billing', {
      target: 'auto_top_up',
      action: 'manage'
    })
  }

  it.for([
    { where: 'Cloud', cloud: true, flag: true },
    { where: 'local web, flag off', cloud: false, flag: false }
  ])('is a plain Platform link on $where', ({ cloud, flag }) => {
    distribution.isCloud = cloud
    setLocalBillingWebEnabled(flag)
    const link = manageLink()

    link.open()

    expect(new URL(link.href.value ?? '').pathname).toBe('/profile/billing')
    expect(openPlatformBillingHandoff).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
      opened
    )
  })

  it('has no URL and opens Platform billing through a handoff once per click on local web with the flag on', () => {
    setLocalBillingWebEnabled(true)
    const link = manageLink()

    link.open()

    expect(link.href.value).toBeUndefined()
    expect(openPlatformBillingHandoff).toHaveBeenCalledOnce()
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
      opened
    )
  })

  it('follows the flag while the link is shown', () => {
    const link = manageLink()
    expect(link.href.value).toBeDefined()

    setLocalBillingWebEnabled(true)

    expect(link.href.value).toBeUndefined()
  })
})
