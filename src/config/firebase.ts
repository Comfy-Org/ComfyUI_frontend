import type { FirebaseOptions } from 'firebase/app'

import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'

const DEV_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyDa_YMeyzV0SkVe92vBZ1tVikWBmOU5KVE',
  authDomain: 'dreamboothy-dev.firebaseapp.com',
  databaseURL: 'https://dreamboothy-dev-default-rtdb.firebaseio.com',
  projectId: 'dreamboothy-dev',
  storageBucket: 'dreamboothy-dev.appspot.com',
  messagingSenderId: '313257147182',
  appId: '1:313257147182:web:be38f6ebf74345fc7618bf',
  measurementId: 'G-YEVSMYXSPY'
}

const PROD_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyC2-fomLqgCjb7ELwta1I9cEarPK8ziTGs',
  authDomain: 'dreamboothy.firebaseapp.com',
  databaseURL: 'https://dreamboothy-default-rtdb.firebaseio.com',
  projectId: 'dreamboothy',
  storageBucket: 'dreamboothy.appspot.com',
  messagingSenderId: '357148958219',
  appId: '1:357148958219:web:f5917f72e5f36a2015310e',
  measurementId: 'G-3ZBD3MBTG4'
}

const BUILD_TIME_CONFIG = __USE_PROD_CONFIG__ ? PROD_CONFIG : DEV_CONFIG

const REQUIRED_FIREBASE_FIELDS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
] as const

/**
 * Whether the server's firebase_config has every field Firebase needs. The type is
 * hand-declared, not generated from the server's contract, so nothing else checks it.
 */
function isCompleteFirebaseConfig(
  runtimeConfig: unknown
): runtimeConfig is FirebaseOptions {
  if (typeof runtimeConfig !== 'object' || runtimeConfig === null) return false
  const fields = runtimeConfig as Record<string, unknown>
  return REQUIRED_FIREBASE_FIELDS.every(
    (field) => typeof fields[field] === 'string' && fields[field] !== ''
  )
}

/**
 * Firebase config for the current backend: the server's firebase_config (cloud builds)
 * when it is complete, else the bundled DEV_CONFIG when the server reports a dev-tier
 * backend, else the build-time default.
 */
export function getFirebaseConfig(): FirebaseOptions {
  const { config } = useRemoteConfigStore()
  const runtimeConfig = config.firebase_config
  if (isCompleteFirebaseConfig(runtimeConfig)) return runtimeConfig
  if (config.firebase_env === 'dev') return DEV_CONFIG
  return BUILD_TIME_CONFIG
}

/** Whether {@link getFirebaseConfig} names the project from the server rather than the build. */
export function hasServerFirebaseConfig(): boolean {
  const { config } = useRemoteConfigStore()
  return (
    isCompleteFirebaseConfig(config.firebase_config) ||
    config.firebase_env === 'dev'
  )
}
