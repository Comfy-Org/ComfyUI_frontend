import { browserLocalPersistence } from 'firebase/auth'

import { createFirebaseIdentity } from '@comfyorg/account/firebase'

import { getFirebaseConfig } from '@/config/firebase'

/**
 * The cloud app's one Firebase entry. `options` is a getter because the app
 * resolves on first use, after remote config has loaded, and this module is
 * evaluated before that. `[DEFAULT]` keeps the IndexedDB session key that
 * persisted sign-ins and the e2e seed are stored under.
 */
export const firebaseIdentity = createFirebaseIdentity({
  get options() {
    return getFirebaseConfig()
  },
  appName: '[DEFAULT]',
  persistence: browserLocalPersistence
})
