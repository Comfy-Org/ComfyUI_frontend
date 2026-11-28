import { describe, expect, it, vi } from 'vitest'

async function loadFirebase(useProdConfig: boolean) {
  vi.resetModules()
  vi.stubGlobal('__USE_PROD_CONFIG__', useProdConfig)
  const { useRemoteConfigStore } =
    await import('@/platform/remoteConfig/remoteConfigStore')
  const { getFirebaseConfig, getFirebaseConfigSource } =
    await import('./firebase')
  return { getFirebaseConfig, getFirebaseConfigSource, useRemoteConfigStore }
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
    const { getFirebaseConfig, useRemoteConfigStore } = await loadFirebase(true)
    useRemoteConfigStore().acceptConfig({ firebase_config: cloudConfig }, false)
    expect(getFirebaseConfig()).toEqual(cloudConfig)
  })

  it('uses the dev project when the server reports firebase_env "dev", even if the build-time fallback is prod', async () => {
    const { getFirebaseConfig, useRemoteConfigStore } = await loadFirebase(true)
    useRemoteConfigStore().acceptConfig({ firebase_env: 'dev' }, false)
    expect(getFirebaseConfig().projectId).toBe('dreamboothy-dev')
  })

  it('falls back to the build-time config when the server names no project', async () => {
    const prod = await loadFirebase(true)
    prod.useRemoteConfigStore().acceptConfig({}, false)
    expect(prod.getFirebaseConfig().projectId).toBe('dreamboothy')

    const dev = await loadFirebase(false)
    dev.useRemoteConfigStore().acceptConfig({}, false)
    expect(dev.getFirebaseConfig().projectId).toBe('dreamboothy-dev')
  })

  it.for([
    { serverConfig: { firebase_config: cloudConfig }, source: 'server' },
    { serverConfig: { firebase_env: 'dev' as const }, source: 'server' },
    { serverConfig: {}, source: 'build-time' }
  ])('reports the $source source for %#', async ({ serverConfig, source }) => {
    const { getFirebaseConfigSource, useRemoteConfigStore } =
      await loadFirebase(true)
    useRemoteConfigStore().acceptConfig(serverConfig, false)
    expect(getFirebaseConfigSource()).toBe(source)
  })
})
