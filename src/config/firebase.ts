import type { FirebaseOptions } from 'firebase/app'

import { isCloud } from '@/platform/distribution/types'
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

type FirebaseEnvironment = {
  isCloudBuild: boolean
  useProdConfig: boolean
  authEmulatorHost?: string
  localProjectId?: string
}

function buildLocalEmulatorConfig(
  buildTimeConfig: FirebaseOptions,
  localProjectId: string | undefined
): FirebaseOptions {
  if (!localProjectId) {
    throw new Error(
      'VITE_FIREBASE_PROJECT_ID is required when VITE_FIREBASE_AUTH_EMULATOR_HOST is set'
    )
  }

  return {
    ...buildTimeConfig,
    projectId: localProjectId,
    authDomain: `${localProjectId}.firebaseapp.com`
  }
}

export function getFirebaseAuthEmulatorUrl(
  host: string | undefined
): string | null {
  return host ? `http://${host}` : null
}

export function getFirebaseConfigForEnvironment({
  isCloudBuild,
  useProdConfig,
  authEmulatorHost,
  localProjectId
}: FirebaseEnvironment): FirebaseOptions {
  const buildTimeConfig = useProdConfig ? PROD_CONFIG : DEV_CONFIG
  if (authEmulatorHost) {
    return buildLocalEmulatorConfig(buildTimeConfig, localProjectId)
  }

  if (!isCloudBuild) {
    return buildTimeConfig
  }

  const runtimeConfig = remoteConfig.value.firebase_config
  return runtimeConfig ?? buildTimeConfig
}

/**
 * Returns the Firebase configuration for the current environment.
 * - Cloud builds use runtime configuration delivered via feature flags
 * - OSS / localhost builds fall back to the build-time config determined by __USE_PROD_CONFIG__
 */
export function getFirebaseConfig(): FirebaseOptions {
  return getFirebaseConfigForEnvironment({
    isCloudBuild: isCloud,
    useProdConfig: __USE_PROD_CONFIG__,
    authEmulatorHost: import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST,
    localProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
  })
}
