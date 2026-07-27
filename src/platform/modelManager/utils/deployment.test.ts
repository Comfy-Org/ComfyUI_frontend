import { afterEach, describe, expect, it, vi } from 'vitest'

import { isLocalDeployment } from './deployment'

const distribution = vi.hoisted(() => ({ isDesktop: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return distribution.isDesktop
  }
}))

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname }
  })
}

describe('isLocalDeployment', () => {
  afterEach(() => {
    distribution.isDesktop = false
  })

  it('is true for the desktop app regardless of hostname', () => {
    distribution.isDesktop = true
    setHostname('some-remote-host.example.com')

    expect(isLocalDeployment()).toBe(true)
  })

  it.for(['localhost', '127.0.0.1', '::1', '[::1]'])(
    'is true for the loopback host %s',
    (hostname) => {
      setHostname(hostname)
      expect(isLocalDeployment()).toBe(true)
    }
  )

  it('is false for a remote hostname', () => {
    setHostname('192.168.1.50')
    expect(isLocalDeployment()).toBe(false)

    setHostname('models.example.com')
    expect(isLocalDeployment()).toBe(false)
  })
})
