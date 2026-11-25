import { describe, expect, it } from 'vitest'

import { useRemoteConfigStore } from './remoteConfigStore'

type RemoteConfigStore = ReturnType<typeof useRemoteConfigStore>

describe('useRemoteConfigStore', () => {
  it.for([
    {
      name: 'unloaded',
      act: (store: RemoteConfigStore) => store.invalidate(),
      loaded: false
    },
    {
      name: 'anonymous',
      act: (store: RemoteConfigStore) => store.acceptConfig({}, false),
      loaded: false
    },
    {
      name: 'authenticated',
      act: (store: RemoteConfigStore) => store.acceptConfig({}, true),
      loaded: true
    },
    {
      name: 'authenticated then reloading',
      act: (store: RemoteConfigStore) => {
        store.acceptConfig({}, true)
        store.beginAuthenticatedLoad()
      },
      loaded: false
    },
    {
      name: 'authenticated then an anonymous read failed',
      act: (store: RemoteConfigStore) => {
        store.acceptConfig({}, true)
        store.failLoad(false)
      },
      loaded: true
    },
    {
      name: 'authenticated then an authenticated read failed',
      act: (store: RemoteConfigStore) => {
        store.acceptConfig({}, true)
        store.failLoad(true)
      },
      loaded: false
    }
  ])('isAuthenticatedConfigLoaded is $loaded when $name', ({ act, loaded }) => {
    const store = useRemoteConfigStore()

    act(store)

    expect(store.isAuthenticatedConfigLoaded).toBe(loaded)
  })
})
