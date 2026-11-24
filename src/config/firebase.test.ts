import { describe, expect, it, vi } from 'vitest'

async function loadFirebase(useProdConfig: boolean) {
  vi.resetModules()
  vi.stubGlobal('__USE_PROD_CONFIG__', useProdConfig)
  const { useRemoteConfigStore } =
    await import('@/platform/remoteConfig/remoteConfigStore')
  const { getFirebaseConfig, hasServerFirebaseConfig } =
    await import('./firebase')
  return { getFirebaseConfig, hasServerFirebaseConfig, useRemoteConfigStore }
}

const CLOUD = {
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
    useRemoteConfigStore().acceptConfig({ firebase_config: CLOUD }, false)
    expect(getFirebaseConfig()).toEqual(CLOUD)
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

  it.for([
    ['an empty object', {}],
    ['a config without appId', { ...CLOUD, appId: undefined }],
    ['a config with an empty projectId', { ...CLOUD, projectId: '' }]
  ] as const)(
    'ignores %s and falls through to firebase_env',
    async ([, incomplete]) => {
      const {
        getFirebaseConfig,
        hasServerFirebaseConfig,
        useRemoteConfigStore
      } = await loadFirebase(true)
      useRemoteConfigStore().acceptConfig(
        { firebase_config: incomplete as never, firebase_env: 'dev' },
        false
      )
      expect(getFirebaseConfig().projectId).toBe('dreamboothy-dev')
      expect(hasServerFirebaseConfig()).toBe(true)
    }
  )

  it('does not count an incomplete firebase_config as naming the project', async () => {
    const { getFirebaseConfig, hasServerFirebaseConfig, useRemoteConfigStore } =
      await loadFirebase(true)
    useRemoteConfigStore().acceptConfig(
      { firebase_config: { projectId: 'some-cloud-project' } as never },
      false
    )
    expect(getFirebaseConfig().projectId).toBe('dreamboothy')
    expect(hasServerFirebaseConfig()).toBe(false)
  })
})
