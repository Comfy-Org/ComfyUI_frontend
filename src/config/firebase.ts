import type { FirebaseOptions } from 'firebase/app'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

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

export type FirebaseConfigSource = 'server' | 'build-time'

function resolveFirebaseConfig(): {
  source: FirebaseConfigSource
  config: FirebaseOptions
} {
  const { firebase_config, firebase_env } = remoteConfig.value
  if (firebase_config) return { source: 'server', config: firebase_config }
  if (firebase_env === 'dev') return { source: 'server', config: DEV_CONFIG }
  return { source: 'build-time', config: BUILD_TIME_CONFIG }
}

/** Whether {@link getFirebaseConfig} names the project from the server or falls back to the build. */
export function getFirebaseConfigSource(): FirebaseConfigSource {
  return resolveFirebaseConfig().source
}

/**
 * Firebase config for the current backend: the server's firebase_config (cloud builds),
 * else the bundled DEV_CONFIG when the server reports a dev-tier backend, else the build-time default.
 */
export function getFirebaseConfig(): FirebaseOptions {
  return resolveFirebaseConfig().config
}
