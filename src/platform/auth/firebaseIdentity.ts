import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence
} from 'firebase/auth'

import { createFirebaseIdentity } from '@comfyorg/account/firebase'

import { assert } from '@/base/assert'
import { getFirebaseConfig } from '@/config/firebase'
import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'

function loadedFirebaseConfig() {
  assert(
    remoteConfigState.value !== 'unloaded',
    'Firebase resolved before remote config loaded: initialize() belongs after the startup/remote-config phase'
  )
  return getFirebaseConfig()
}

/**
 * `[DEFAULT]` keeps the session key persisted sign-ins and the e2e seed are
 * stored under. Firebase reads an existing user from every listed persistence
 * in order and migrates it into the first available one, so a session that
 * vuefire's IndexedDB default persisted (the e2e seed too) is restored and
 * settles in localStorage, where `setPersistence(auth, browserLocalPersistence)`
 * used to move it.
 */
export const firebaseIdentity = createFirebaseIdentity({
  options: loadedFirebaseConfig,
  appName: '[DEFAULT]',
  persistence: [
    browserLocalPersistence,
    indexedDBLocalPersistence,
    browserSessionPersistence
  ]
})
