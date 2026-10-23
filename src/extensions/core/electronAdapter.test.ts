import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyApp } from '@/scripts/app'

const mocks = vi.hoisted(() => ({
  isDesktop: true,
  registerExtension: vi.fn(),
  getElectronVersion: vi.fn<() => Promise<string>>()
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: __DISTRIBUTION__,
  isCloud: false,
  isNightly: __IS_NIGHTLY__,
  get isDesktop() {
    return mocks.isDesktop
  }
}))

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({ registerExtension: mocks.registerExtension })
}))

vi.mock(import('@/utils/envUtil'), () => ({
  electronAPI: () =>
    fromPartial<ElectronAPI>({ getElectronVersion: mocks.getElectronVersion })
}))

vi.mock(import('@/platform/telemetry/reportError'))

const { registerElectronAdapterExtension } = await import('./electronAdapter')
const importEffects = {
  versionReads: mocks.getElectronVersion.mock.calls.length,
  registrations: mocks.registerExtension.mock.calls.length
}

describe('electronAdapter', () => {
  beforeEach(() => {
    mocks.isDesktop = true
    mocks.getElectronVersion.mockResolvedValue('1.2.3')
  })

  it('registers nothing when its module is imported', () => {
    expect(importEffects).toEqual({ versionReads: 0, registrations: 0 })
  })

  it('registers the desktop extension once with the app version badge', async () => {
    await expect(registerElectronAdapterExtension()).resolves.toBe(true)

    expect(mocks.registerExtension).toHaveBeenCalledOnce()
    expect(mocks.registerExtension).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Comfy.ElectronAdapter',
        aboutPageBadges: [
          expect.objectContaining({ label: 'ComfyUI_desktop v1.2.3' })
        ]
      })
    )
  })

  it('reports a failed version read and registers nothing', async () => {
    const cause = new Error('ipc unavailable')
    mocks.getElectronVersion.mockRejectedValue(cause)

    await expect(registerElectronAdapterExtension()).resolves.toBe(false)

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      cause,
      expect.objectContaining({
        errorType: 'failure_reading_desktop_app_version'
      })
    )
    expect(mocks.registerExtension).not.toHaveBeenCalled()
  })

  it('registers nothing outside the desktop app', async () => {
    mocks.isDesktop = false

    await expect(registerElectronAdapterExtension()).resolves.toBe(false)

    expect(mocks.getElectronVersion).not.toHaveBeenCalled()
    expect(mocks.registerExtension).not.toHaveBeenCalled()
  })
})
