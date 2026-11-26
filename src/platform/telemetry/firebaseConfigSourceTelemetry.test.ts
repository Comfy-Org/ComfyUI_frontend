import type { DatadogRum } from '@datadog/browser-rum'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installDatadogRum } from '@comfyorg/telemetry/rumContext'

import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'

import { reportFirebaseConfigSource } from './firebaseConfigSourceTelemetry'

const addAction = vi.fn()
const setGlobalContextProperty = vi.fn()

describe('reportFirebaseConfigSource', () => {
  beforeEach(() => {
    installDatadogRum(
      fromPartial<DatadogRum>({ addAction, setGlobalContextProperty })
    )
  })

  it('tags the session with the server-named project and records no fallback', () => {
    useRemoteConfigStore().acceptConfig(
      {
        firebase_config: {
          apiKey: 'key',
          authDomain: 'cloud.example.com',
          projectId: 'server-project',
          storageBucket: 'cloud.appspot.com',
          messagingSenderId: '1',
          appId: '1:1:web:abc'
        }
      },
      false
    )

    reportFirebaseConfigSource()

    expect(Object.fromEntries(setGlobalContextProperty.mock.calls)).toEqual({
      firebase_project: 'server-project',
      remote_config_source: 'server'
    })
    expect(addAction).not.toHaveBeenCalled()
  })

  it('records a build-time fallback with the read failure', () => {
    const store = useRemoteConfigStore()
    store.acceptConfig({}, false)
    store.failLoad(false, { reason: 'http', status: 503 })

    reportFirebaseConfigSource()

    expect(setGlobalContextProperty).toHaveBeenCalledWith(
      'remote_config_source',
      'build-time'
    )
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      'remote_config_bootstrap_fallback',
      { reason: 'http', status: 503 }
    )
  })

  it('records a build-time fallback with a missing key when the read succeeded', () => {
    useRemoteConfigStore().acceptConfig({}, false)

    reportFirebaseConfigSource()

    expect(setGlobalContextProperty).toHaveBeenCalledWith(
      'remote_config_source',
      'build-time'
    )
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      'remote_config_bootstrap_fallback',
      { reason: 'missing_key' }
    )
  })
})
