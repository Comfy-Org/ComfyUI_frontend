import { describe, expect, it, vi } from 'vitest'

import { getDesktopInstallId } from '@/platform/auth/session/desktopInstallId'

/** A partial Desktop bridge is all these tests exercise; `vi.stubGlobal`
 *  installs it and the shared test setup unstubs globals after each test. */
type BridgeFixture = { getInstallId?: () => string }

function stubBridge(bridge: BridgeFixture | undefined): void {
  vi.stubGlobal('__comfyDesktop2', bridge)
}

describe('getDesktopInstallId', () => {
  it('returns null on plain web (no Desktop bridge)', () => {
    stubBridge(undefined)
    expect(getDesktopInstallId()).toBeNull()
  })

  it('returns null on a Desktop build without getInstallId', () => {
    stubBridge({})
    expect(getDesktopInstallId()).toBeNull()
  })

  it('returns the install id the bridge reports', () => {
    stubBridge({ getInstallId: () => 'install-abc' })
    expect(getDesktopInstallId()).toBe('install-abc')
  })

  it('returns null and swallows a throwing bridge', () => {
    stubBridge({
      getInstallId: vi.fn(() => {
        throw new Error('bridge boom')
      })
    })
    expect(getDesktopInstallId()).toBeNull()
  })
})
