/**
 * Orchestration store for the server-side missing-models flow.
 *
 * Responsibilities:
 *   - Track the set of (model_id, url) pairs declared by the workflow.
 *   - Poll the unified ``/api/models-availability-status`` every 1s while
 *     anything is still missing-and-not-gated or downloading.
 *   - Expose start / cancel / login actions.
 *
 * Per-model metadata (file_size, is_hf_downloadable) is part of the
 * polling response — the server caches what it can and re-evaluates
 * the rest per call. The client maintains no separate metadata cache.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { api } from '@/scripts/api'
import {
  cancelModelDownload,
  fetchAvailabilityStatus,
  ServerDownloadError,
  startHfAuthLogin,
  startModelDownloads
} from '@/platform/missingModel/serverDownloads/serverDownloadsApi'
import type {
  HfAuthStatus,
  ModelStatusEntry
} from '@/platform/missingModel/serverDownloads/serverDownloadsApi'

const POLL_INTERVAL_MS = 1000

/** True iff the server registered itself as supporting this flow.
 *  Old servers will not have this key — fall back to the legacy
 *  in-browser download path. */
export function isServerSideDownloadsAvailable(): boolean {
  const flags = api.serverFeatureFlags.value as Record<string, unknown>
  return flags['server_side_model_downloads'] === true
}

interface RegisteredModel {
  modelId: string
  url: string
}

export const useServerSideDownloadsStore = defineStore(
  'serverSideDownloads',
  () => {
    /** model_id → URL the workflow declared for it. */
    const registered = ref<Record<string, RegisteredModel>>({})

    /** model_id → server's per-poll snapshot. Replaced wholesale on each
     *  poll that observes any difference. */
    const models = ref<Record<string, ModelStatusEntry>>({})

    const hfAuth = ref<HfAuthStatus>({
      token_available: false,
      eligible: false
    })

    let pollHandle: ReturnType<typeof setInterval> | null = null

    /** Guards against overlapping polls when a refresh outlives the
     *  poll interval — prevents request pile-up and out-of-order writes. */
    let refreshInFlight = false

    /** Keep polling alive after starting OAuth so the panel auto-flips
     *  once the token lands, even when every row is currently gated. */
    let awaitingHfLogin = false

    // ----- derived views -----

    /** Missing rows we can attempt to download (excludes gated-to-us). */
    const downloadableMissingIds = computed<string[]>(() => {
      const ids: string[] = []
      const m = models.value
      for (const id of Object.keys(m)) {
        const entry = m[id]
        if (entry.state !== 'missing') continue
        if (entry.is_hf_downloadable === false) continue
        ids.push(id)
      }
      return ids
    })

    /** Missing rows that we can't currently fetch (gated, no access). */
    const gatedMissingIds = computed<string[]>(() => {
      const ids: string[] = []
      const m = models.value
      for (const id of Object.keys(m)) {
        const entry = m[id]
        if (entry.state === 'missing' && entry.is_hf_downloadable === false) {
          ids.push(id)
        }
      }
      return ids
    })

    const hasAnyGated = computed(() => gatedMissingIds.value.length > 0)

    function entryOf(modelId: string): ModelStatusEntry | undefined {
      return models.value[modelId]
    }

    // ----- registration: who's in this workflow -----

    function setRegistered(items: RegisteredModel[]) {
      registered.value = Object.fromEntries(items.map((it) => [it.modelId, it]))
      models.value = {}
      void refresh()
      ensurePolling()
    }

    function clear() {
      registered.value = {}
      models.value = {}
      awaitingHfLogin = false
      stopPolling()
    }

    // ----- backend calls -----

    function registeredModelsMap(): Record<string, string> {
      const map: Record<string, string> = {}
      const r = registered.value
      for (const id of Object.keys(r)) {
        map[id] = r[id].url
      }
      return map
    }

    async function refresh(): Promise<void> {
      if (refreshInFlight) return
      const map = registeredModelsMap()
      if (Object.keys(map).length === 0) return
      refreshInFlight = true
      try {
        const data = await fetchAvailabilityStatus(map)
        if (!modelsEqual(models.value, data.models)) {
          models.value = data.models
        }
        hfAuth.value = data.hf_auth
        if (hfAuth.value.token_available) {
          awaitingHfLogin = false
        }
        maybeStopPolling()
      } catch (err) {
        console.warn('[serverSideDownloads] poll failed:', err)
      } finally {
        refreshInFlight = false
      }
    }

    /** Stop the timer when nothing more can change without a user action.
     *  Gated-to-us entries stay in ``missing`` until login or license
     *  acceptance; both of those trigger an explicit refresh elsewhere. */
    function maybeStopPolling() {
      if (awaitingHfLogin && !hfAuth.value.token_available) return
      const m = models.value
      for (const id of Object.keys(m)) {
        const entry = m[id]
        if (entry.state === 'downloading') return
        if (entry.state === 'missing' && entry.is_hf_downloadable !== false) {
          return
        }
      }
      stopPolling()
    }

    async function startDownload(modelIds: string[]): Promise<void> {
      const map: Record<string, string> = {}
      for (const id of modelIds) {
        const reg = registered.value[id]
        if (!reg) continue
        map[id] = reg.url
      }
      if (Object.keys(map).length === 0) return

      try {
        await startModelDownloads(map)
      } catch (err) {
        if (err instanceof ServerDownloadError) {
          console.warn(
            `[serverSideDownloads] download rejected (${err.code}): ${err.message}`,
            err.details
          )
        } else {
          console.warn('[serverSideDownloads] download failed:', err)
        }
        // Re-poll so the UI reflects whatever state actually obtains
        // server-side (race: someone else may have already taken the
        // file we tried to start).
        void refresh()
        throw err
      }

      ensurePolling()
      // Eagerly poll so the user sees the progress bar appear immediately.
      void refresh()
    }

    async function startSingleDownload(modelId: string): Promise<void> {
      await startDownload([modelId])
    }

    async function cancelDownload(modelId: string): Promise<void> {
      try {
        await cancelModelDownload(modelId)
      } finally {
        void refresh()
      }
    }

    /** Trigger the OAuth flow and open the authorize URL in a new tab. */
    async function beginHfLogin(): Promise<void> {
      try {
        const { authorize_url } = await startHfAuthLogin()
        awaitingHfLogin = true
        window.open(authorize_url, '_blank', 'noopener,noreferrer')
        ensurePolling()
      } catch (err) {
        console.warn('[serverSideDownloads] HF login start failed:', err)
        throw err
      }
    }

    // ----- polling lifecycle -----

    function ensurePolling() {
      if (pollHandle !== null) return
      pollHandle = setInterval(() => {
        void refresh()
      }, POLL_INTERVAL_MS)
    }

    function stopPolling() {
      if (pollHandle !== null) {
        clearInterval(pollHandle)
        pollHandle = null
      }
    }

    return {
      // state
      models,
      hfAuth,
      // derived
      downloadableMissingIds,
      gatedMissingIds,
      hasAnyGated,
      entryOf,
      // actions
      setRegistered,
      clear,
      refresh,
      startDownload,
      startSingleDownload,
      cancelDownload,
      beginHfLogin
    }
  }
)

/** Cheap structural diff that lets us skip reactive writes when the
 *  poll returns identical data — saves needless re-renders during
 *  long-running downloads where nothing actually changed yet. */
function modelsEqual(
  a: Record<string, ModelStatusEntry>,
  b: Record<string, ModelStatusEntry>
): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const id of ak) {
    const x = a[id]
    const y = b[id]
    if (!y) return false
    if (x.state !== y.state) return false
    if (x.file_size !== y.file_size) return false
    if (x.is_hf_downloadable !== y.is_hf_downloadable) return false
    const xp = x.progress
    const yp = y.progress
    if ((xp === null) !== (yp === null)) return false
    if (xp && yp) {
      if (
        xp.bytes_downloaded !== yp.bytes_downloaded ||
        xp.total_bytes !== yp.total_bytes
      ) {
        return false
      }
    }
  }
  return true
}
