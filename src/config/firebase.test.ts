import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFirebase(useProdConfig: boolean) {
  vi.resetModules()
  vi.stubGlobal('__USE_PROD_CONFIG__', useProdConfig)
  const { remoteConfig } = await import('@/platform/remoteConfig/remoteConfig')
  const { getFirebaseConfig } = await import('./firebase')
  return { getFirebaseConfig, remoteConfig }
}

describe('getFirebaseConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('honors a full server-provided firebase_config (cloud builds)', async () => {
    const cloud = {
      apiKey: 'cloud-key',
      authDomain: 'cloud.example.com',
      projectId: 'some-cloud-project',
      storageBucket: 'cloud.appspot.com',
      messagingSenderId: '1',
      appId: '1:1:web:abc'
    }
    const { getFirebaseConfig, remoteConfig } = await loadFirebase(true)
    remoteConfig.value = { firebase_config: cloud }
    expect(getFirebaseConfig()).toEqual(cloud)
  })

  it('uses the dev project when the server reports firebase_env "dev", even if the build-time fallback is prod', async () => {
    const { getFirebaseConfig, remoteConfig } = await loadFirebase(true)
    remoteConfig.value = { firebase_env: 'dev' }
    expect(getFirebaseConfig().projectId).toBe('dreamboothy-dev')
  })

  it('falls back to the build-time config when the server reports no firebase_env', async () => {
    const prod = await loadFirebase(true)
    prod.remoteConfig.value = {}
    expect(prod.getFirebaseConfig().projectId).toBe('dreamboothy')

    const dev = await loadFirebase(false)
    dev.remoteConfig.value = {}
    expect(dev.getFirebaseConfig().projectId).toBe('dreamboothy-dev')
  })
})
