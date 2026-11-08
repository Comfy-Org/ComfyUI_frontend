import { describe, expect, it, vi } from 'vitest'

async function loadFirebase(useProdConfig: boolean) {
  vi.resetModules()
  vi.stubGlobal('__USE_PROD_CONFIG__', useProdConfig)
  const { remoteConfig } = await import('@/platform/remoteConfig/remoteConfig')
  const { getFirebaseConfig, getFirebaseConfigSource } =
    await import('./firebase')
  return { getFirebaseConfig, getFirebaseConfigSource, remoteConfig }
}

const cloudConfig = {
  apiKey: 'cloud-key',
  authDomain: 'cloud.example.com',
  projectId: 'some-cloud-project',
  storageBucket: 'cloud.appspot.com',
  messagingSenderId: '1',
  appId: '1:1:web:abc'
}

describe('getFirebaseConfig', () => {
  it('honors a full server-provided firebase_config (cloud builds)', async () => {
    const { getFirebaseConfig, remoteConfig } = await loadFirebase(true)
    remoteConfig.value = { firebase_config: cloudConfig }
    expect(getFirebaseConfig()).toEqual(cloudConfig)
  })

  it('falls back to the build-time config when the server sends no firebase_config', async () => {
    const prod = await loadFirebase(true)
    prod.remoteConfig.value = {}
    expect(prod.getFirebaseConfig().projectId).toBe('dreamboothy')

    const dev = await loadFirebase(false)
    dev.remoteConfig.value = {}
    expect(dev.getFirebaseConfig().projectId).toBe('dreamboothy-dev')
  })

  it.for([
    { serverConfig: { firebase_config: cloudConfig }, source: 'server' },
    { serverConfig: {}, source: 'build-time' }
  ])('reports the $source source', async ({ serverConfig, source }) => {
    const { getFirebaseConfigSource, remoteConfig } = await loadFirebase(true)
    remoteConfig.value = serverConfig
    expect(getFirebaseConfigSource()).toBe(source)
  })
})
