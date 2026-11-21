import type { DatadogRum } from '@datadog/browser-rum'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installDatadogRum } from '@comfyorg/telemetry/rumContext'

import {
  remoteConfig,
  remoteConfigFailure
} from '@/platform/remoteConfig/remoteConfig'

import { reportFirebaseConfigSource } from './firebaseConfigSourceTelemetry'

const addAction = vi.fn()
const setGlobalContextProperty = vi.fn()

describe('reportFirebaseConfigSource', () => {
  beforeEach(() => {
    installDatadogRum(
      fromPartial<DatadogRum>({ addAction, setGlobalContextProperty })
    )
    remoteConfig.value = {}
    remoteConfigFailure.value = null
  })

  it('tags the session with the server-named project and records no fallback', () => {
    remoteConfig.value = {
      firebase_config: {
        apiKey: 'key',
        authDomain: 'cloud.example.com',
        projectId: 'server-project',
        storageBucket: 'cloud.appspot.com',
        messagingSenderId: '1',
        appId: '1:1:web:abc'
      }
    }

    reportFirebaseConfigSource()

    expect(Object.fromEntries(setGlobalContextProperty.mock.calls)).toEqual({
      firebase_project: 'server-project',
      remote_config_source: 'server'
    })
    expect(addAction).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'the read failure',
      failure: { reason: 'http', status: 503 } as const,
      expected: { reason: 'http', status: 503 }
    },
    {
      name: 'a missing key when the read succeeded',
      failure: null,
      expected: { reason: 'missing_key' }
    }
  ])('records a build-time fallback with $name', ({ failure, expected }) => {
    remoteConfigFailure.value = failure

    reportFirebaseConfigSource()

    expect(setGlobalContextProperty).toHaveBeenCalledWith(
      'remote_config_source',
      'build-time'
    )
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      'remote_config_bootstrap_fallback',
      expected
    )
  })
})
