import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { setTelemetryRegistry, useTelemetry } from '@/platform/telemetry'
import { initHostTelemetry } from '@/platform/telemetry/initHostTelemetry'
import { TelemetryEvents } from '@/platform/telemetry/types'

const fetchMock = vi.fn()
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

describe('initHostTelemetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', localStorageMock)
  })

  afterEach(() => {
    remoteConfig.value = {}
    setTelemetryRegistry(null)
    delete window.__comfyDesktop2
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('leaves the registry untouched when enable_telemetry is on but the host Telemetry bridge is absent', () => {
    remoteConfig.value = { enable_telemetry: true }

    initHostTelemetry()

    expect(useTelemetry()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves the registry untouched when enable_telemetry is off', () => {
    window.__comfyDesktop2 = {
      isRemote: () => false,
      Telemetry: { capture: vi.fn() }
    }
    remoteConfig.value = { enable_telemetry: false }

    initHostTelemetry()

    expect(useTelemetry()).toBeNull()
  })

  it('registers the host telemetry sink when enable_telemetry and the bridge are present', () => {
    const capture = vi.fn()
    window.__comfyDesktop2 = { isRemote: () => false, Telemetry: { capture } }
    remoteConfig.value = { enable_telemetry: true }

    initHostTelemetry()
    useTelemetry()?.trackSignupOpened()

    expect(capture).toHaveBeenCalledWith(
      TelemetryEvents.USER_SIGN_UP_OPENED,
      undefined
    )
  })
})
