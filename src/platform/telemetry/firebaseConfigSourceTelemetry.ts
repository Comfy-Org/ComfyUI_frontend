import { getDatadogRum } from '@comfyorg/telemetry/rumContext'

import { getFirebaseConfig, getFirebaseConfigSource } from '@/config/firebase'
import { remoteConfigFailure } from '@/platform/remoteConfig/remoteConfig'

const BOOTSTRAP_FALLBACK_ACTION = 'remote_config_bootstrap_fallback'

/** Tags the RUM session with the Firebase project startup initialized with, and records any build-time fallback. */
export function reportFirebaseConfigSource(): void {
  const rum = getDatadogRum()
  if (!rum) return
  const source = getFirebaseConfigSource()
  rum.setGlobalContextProperty(
    'firebase_project',
    getFirebaseConfig().projectId
  )
  rum.setGlobalContextProperty('remote_config_source', source)
  if (source === 'server') return
  rum.addAction(
    BOOTSTRAP_FALLBACK_ACTION,
    remoteConfigFailure.value ?? { reason: 'missing_key' }
  )
}
