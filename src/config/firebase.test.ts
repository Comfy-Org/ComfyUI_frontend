import { describe, expect, it, vi } from 'vitest'

async function loadFirebase(useProdConfig: boolean) {
  vi.resetModules()
  vi.stubGlobal('__USE_PROD_CONFIG__', useProdConfig)
  const { useRemoteConfigStore } =
    await import('@/platform/remoteConfig/remoteConfigStore')
  const { getFirebaseConfig } = await import('./firebase')
  return { getFirebaseConfig, useRemoteConfigStore }
}

describe('getFirebaseConfig', () => {
  it('honors a full server-provided firebase_config (cloud builds)', async () => {
    const cloud = {
      apiKey: 'cloud-key',
      authDomain: 'cloud.example.com',
      projectId: 'some-cloud-project',
      storageBucket: 'cloud.appspot.com',
      messagingSenderId: '1',
      appId: '1:1:web:abc'
    }
    const { getFirebaseConfig, useRemoteConfigStore } = await loadFirebase(true)
    useRemoteConfigStore().acceptConfig({ firebase_config: cloud }, false)
    expect(getFirebaseConfig()).toEqual(cloud)
  })

  it('uses the dev project when the server reports firebase_env "dev", even if the build-time fallback is prod', async () => {
    const { getFirebaseConfig, useRemoteConfigStore } = await loadFirebase(true)
    useRemoteConfigStore().acceptConfig({ firebase_env: 'dev' }, false)
    expect(getFirebaseConfig().projectId).toBe('dreamboothy-dev')
  })

  it('falls back to the build-time config when the server reports no firebase_env', async () => {
    const prod = await loadFirebase(true)
    prod.useRemoteConfigStore().acceptConfig({}, false)
    expect(prod.getFirebaseConfig().projectId).toBe('dreamboothy')

    const dev = await loadFirebase(false)
    dev.useRemoteConfigStore().acceptConfig({}, false)
    expect(dev.getFirebaseConfig().projectId).toBe('dreamboothy-dev')
  })
})
