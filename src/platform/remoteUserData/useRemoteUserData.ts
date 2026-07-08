import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { ZodType } from 'zod'

import { getDevOverride } from '@/utils/devFeatureFlagOverride'

import type { RemoteUserDataKey } from './keys'
import { getPayloadSource, remoteUserDataReady } from './payloadSource'

/**
 * `snapshot` (default): `data` resolves once when readiness flips true (or
 * immediately if already ready) and is then frozen. Use for anything the user
 * interacts with mid-flow (surveys, welcome tiles, modal content).
 *
 * `reactive`: `data` tracks every flag reload. Use only where a late update is
 * harmless (e.g. sidebar ordering).
 */
type RemoteUserDataMode = 'snapshot' | 'reactive'

interface UseRemoteUserDataOptions<T> {
  key: RemoteUserDataKey
  schema: ZodType<T>
  defaultValue: T
  mode?: RemoteUserDataMode
}

interface UseRemoteUserDataResult<T> {
  data: Readonly<Ref<T>>
  isLoaded: Readonly<Ref<boolean>>
}

/**
 * Reads a per-user/per-cohort JSON payload for `key`, validated against `schema`,
 * falling back to `defaultValue`. `isLoaded` is the shared readiness signal:
 * instantly true when no PostHog source exists, otherwise true once the first
 * authoritative flag response arrives.
 *
 * Never throws — a hand-edited payload that fails validation logs a warning and
 * resolves to the default.
 */
export function useRemoteUserData<T>(
  options: UseRemoteUserDataOptions<T>
): UseRemoteUserDataResult<T> {
  const { key, schema, defaultValue, mode = 'snapshot' } = options

  // Reactive mode re-resolves on every flag reload; dedupe by serialized value
  // so a persistently invalid payload warns once rather than on each reload.
  let lastWarnedRaw: string | undefined
  function resolve(): T {
    const override = getDevOverride<unknown>(key)
    const raw =
      override !== undefined
        ? override
        : getPayloadSource()?.payloads.value[key]
    if (raw === undefined) return defaultValue

    const parsed = schema.safeParse(raw)
    if (parsed.success) return parsed.data

    const rawKey = JSON.stringify(raw)
    if (rawKey !== lastWarnedRaw) {
      lastWarnedRaw = rawKey
      console.warn(
        `[remoteUserData] Invalid payload for "${key}":`,
        parsed.error
      )
    }
    return defaultValue
  }

  if (mode === 'reactive') {
    return { data: computed(resolve), isLoaded: remoteUserDataReady }
  }

  const data = ref(
    remoteUserDataReady.value ? resolve() : defaultValue
  ) as Ref<T>

  if (!remoteUserDataReady.value) {
    const stop = watch(remoteUserDataReady, (ready) => {
      if (!ready) return
      data.value = resolve()
      stop()
    })
  }

  return { data, isLoaded: remoteUserDataReady }
}
