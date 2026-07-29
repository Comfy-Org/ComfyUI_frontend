import { useEventListener, useIntervalFn } from '@vueuse/core'
import { ref } from 'vue'
import { z } from 'zod'

import { api } from '@/scripts/api'

const REFRESH_INTERVAL_MS = 120_000

const featuresResponseSchema = z.object({
  supports_model_type_tags: z.boolean().optional()
})

/**
 * `supports_model_type_tags` as served by HTTP `GET /features`, or undefined
 * until a fetch has seen the key. The websocket copy of the flag is sent only
 * once per connection, so an open session never observes a server-side flip
 * (a rollback leaves stale tabs on the wrong tagging scheme); this HTTP
 * source exists so the flag can refresh mid-session. Deliberately not
 * sourced from remoteConfig: refreshRemoteConfig clears to {} on any fetch
 * error (would flap this flag and trigger spurious model reloads), lacks
 * reconnect/visibility triggers, and has no response-ordering guard.
 * Consolidation tracked in FE-1439.
 */
export const httpSupportsModelTypeTags = ref<boolean | undefined>(undefined)

let refreshSequence = 0

export async function refreshSupportsModelTypeTags(): Promise<void> {
  const sequence = ++refreshSequence
  try {
    const response = await api.fetchApi('/features', { cache: 'no-store' })
    if (!response.ok) return
    const features: unknown = await response.json()
    // The refresh triggers can overlap (reconnect, visibility, interval); a
    // superseded fetch must not commit, or a slow pre-flip response could
    // revert a newer value.
    if (sequence !== refreshSequence) return
    const parsed = featuresResponseSchema.safeParse(features)
    httpSupportsModelTypeTags.value = parsed.success
      ? parsed.data.supports_model_type_tags
      : undefined
  } catch {
    // A failed fetch keeps the last known value; a backend that never serves
    // the key stays undefined and the websocket flag remains authoritative.
  }
}

/**
 * Keeps {@link httpSupportsModelTypeTags} current for the app's lifetime:
 * fetches immediately, again whenever the websocket reconnects or the tab
 * returns to the foreground, and on a slow interval while visible. The server
 * caches `/features` responses, so the interval is cheap.
 */
export function useSupportsModelTypeTagsRefresh(): void {
  void refreshSupportsModelTypeTags()
  useEventListener(api, 'reconnected', () => {
    void refreshSupportsModelTypeTags()
  })
  useEventListener(document, 'visibilitychange', () => {
    if (!document.hidden) void refreshSupportsModelTypeTags()
  })
  useIntervalFn(() => {
    if (document.hidden) return
    void refreshSupportsModelTypeTags()
  }, REFRESH_INTERVAL_MS)
}
