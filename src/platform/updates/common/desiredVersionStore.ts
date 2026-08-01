import { defineStore } from 'pinia'
import { computed, readonly, ref } from 'vue'

import { probeFrontendVersion } from './frontendVersionProbe'

/**
 * Tracks the "desired" frontend version served by the edge and compares it to
 * the version of the bundle currently running in this tab.
 *
 * The edge advertises the desired version via the `X-Frontend-Version` response
 * header (see {@link probeFrontendVersion}); the running bundle is
 * `__COMFYUI_FRONTEND_COMMIT__`. When a promote/abort changes the desired
 * version, open tabs still run the old bundle — this store detects that drift so
 * the app can offer a non-blocking reload.
 *
 * Polling is deliberately cheap: callers refresh on window focus (or by
 * piggybacking on existing activity), never on a tight timer.
 */
export const useDesiredVersionStore = defineStore('desiredVersion', () => {
  const runningVersion = __COMFYUI_FRONTEND_COMMIT__

  // The most recent desired version read from the edge. `null` until the first
  // successful probe (or when the edge does not advertise a version).
  const desiredVersion = ref<string | null>(null)

  /**
   * True when the edge advertises a concrete version that differs from the
   * bundle running in this tab. A missing/unknown desired version never counts
   * as drift, so we don't prompt on environments that don't serve the header.
   */
  const hasNewVersion = computed(
    () =>
      desiredVersion.value !== null && desiredVersion.value !== runningVersion
  )

  /**
   * Probes the edge for the desired version and updates {@link desiredVersion}.
   *
   * Swallows network/timeout errors and OK-but-headerless responses: a failed
   * probe simply leaves the last known desired version untouched rather than
   * clearing a previously observed drift.
   */
  async function refresh(): Promise<void> {
    try {
      const probe = await probeFrontendVersion()
      if (!probe || probe.version === null) return
      desiredVersion.value = probe.version
    } catch {
      // Ignore — the edge may be briefly unreachable; keep the last signal.
    }
  }

  return {
    runningVersion,
    desiredVersion: readonly(desiredVersion),
    hasNewVersion,
    refresh
  }
})
