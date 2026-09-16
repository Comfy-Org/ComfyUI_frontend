import { browserLocalPersistence } from 'firebase/auth'

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

/** `[DEFAULT]` keeps the IndexedDB session key persisted sign-ins and the e2e seed are stored under. */
export const firebaseIdentity = createFirebaseIdentity({
  options: loadedFirebaseConfig,
  appName: '[DEFAULT]',
  persistence: browserLocalPersistence
})
