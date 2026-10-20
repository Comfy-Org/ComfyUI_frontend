import { afterEach, describe, expect, it, vi } from 'vitest'

import { getDesktopInstallId } from '@/platform/auth/session/desktopInstallId'

type MutableWindow = typeof window & {
  __comfyDesktop2?: { getInstallId?: () => string }
}

const win = window as MutableWindow

afterEach(() => {
  delete win.__comfyDesktop2
})

describe('getDesktopInstallId', () => {
  it('returns null on plain web (no Desktop bridge)', () => {
    expect(getDesktopInstallId()).toBeNull()
  })

  it('returns null on a Desktop build without getInstallId', () => {
    win.__comfyDesktop2 = {}
    expect(getDesktopInstallId()).toBeNull()
  })

  it('returns the install id the bridge reports', () => {
    win.__comfyDesktop2 = { getInstallId: () => 'install-abc' }
    expect(getDesktopInstallId()).toBe('install-abc')
  })

  it('returns null and swallows a throwing bridge', () => {
    win.__comfyDesktop2 = {
      getInstallId: vi.fn(() => {
        throw new Error('bridge boom')
      })
    }
    expect(getDesktopInstallId()).toBeNull()
  })
})
