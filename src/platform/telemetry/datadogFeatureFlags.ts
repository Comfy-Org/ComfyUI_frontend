// eslint-disable-next-line no-restricted-imports -- this telemetry sink owns native RUM feature flag reporting
import { datadogRum } from '@datadog/browser-rum'
import type { RumEvent } from '@datadog/browser-rum'

const RESERVED_FLAG_KEY_CHARS = /[.:+\-=&|><!(){}[\]^"“”~*?\\\s]/g

const featureFlags = new Map<string, unknown>()
let synchronizedViewId: string | undefined
let syncScheduled = false

function scheduleFeatureFlagSync(): void {
  if (syncScheduled) return
  syncScheduled = true

  queueMicrotask(() => {
    syncScheduled = false
    const viewId = datadogRum.getInternalContext()?.view?.id
    if (!viewId || !featureFlags.size) return

    for (const [key, value] of featureFlags) {
      datadogRum.addFeatureFlagEvaluation(key, value)
    }
    synchronizedViewId = viewId
    datadogRum.setViewContextProperty('feature_flags_initialized', true)
  })
}

export function trackDatadogFeatureFlagEvaluation(
  key: string,
  value: unknown
): void {
  const normalizedKey = key.replace(RESERVED_FLAG_KEY_CHARS, '_')
  featureFlags.set(normalizedKey, value)
  datadogRum.addFeatureFlagEvaluation(normalizedKey, value)
  scheduleFeatureFlagSync()
}

export function syncDatadogViewFeatureFlags(event: RumEvent): void {
  if (
    event.type === 'view' &&
    event.view.is_active &&
    event.view.id !== synchronizedViewId
  ) {
    scheduleFeatureFlagSync()
  }
}
