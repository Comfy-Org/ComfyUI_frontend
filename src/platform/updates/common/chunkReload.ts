import type { Router } from 'vue-router'

import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

/**
 * Recover from stale-chunk failures automatically.
 *
 * After a new frontend deploys, the previously-loaded `index.html` may reference
 * hashed JS/CSS chunks that no longer exist on the server. Any subsequent dynamic
 * import (route/component lazy-load) then fails with Vite's `vite:preloadError`
 * event or a `ChunkLoadError` promise rejection, producing a white screen.
 *
 * Because `index.html` is always served fresh (never fingerprinted), a single
 * `location.reload()` pulls the current, self-consistent version and the failure
 * becomes a transparent reload.
 *
 * Two safeguards keep this from becoming destructive:
 *  - A reload loop-guard (`sessionStorage`) reloads at most once per session, so a
 *    genuinely-missing asset does not trap the user in an endless reload cycle.
 *  - Unsaved-edit / active-generation awareness: if the user has dirty workflows
 *    or a running job, we do NOT reload immediately. Instead we defer and reload
 *    at the next safe navigation, so user work is never blown away.
 */

/** sessionStorage key marking that we have already attempted a recovery reload. */
export const CHUNK_RELOAD_GUARD_KEY = 'comfy:chunk-reload-attempted'

let deferredReloadArmed = false

function guardAlreadySet(storage: Storage): boolean {
  try {
    return storage.getItem(CHUNK_RELOAD_GUARD_KEY) !== null
  } catch {
    // If sessionStorage is unavailable (e.g. privacy mode), be conservative and
    // treat the guard as set so we never risk a reload loop.
    return true
  }
}

function setGuard(storage: Storage): void {
  try {
    storage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    // Best-effort: if we cannot persist the guard we still proceed with the
    // reload (the caller has already checked it was unset), accepting that a
    // second failure could reload again. This is rare and preferable to leaving
    // the user on a broken page.
  }
}

/**
 * Whether reloading now is safe (no unsaved edits and no active generation).
 *
 * Dirty state is detected via the same signal the beforeunload confirmation uses
 * (`workflowStore.modifiedWorkflows`); active generation via the execution store's
 * running jobs.
 */
function isReloadSafe(): boolean {
  try {
    const workflowStore = useWorkflowStore()
    if (workflowStore.modifiedWorkflows.length > 0) return false

    const executionStore = useExecutionStore()
    if (executionStore.runningJobIds.length > 0) return false

    return true
  } catch {
    // If stores are not ready we cannot prove safety; err on the side of not
    // interrupting the user.
    return false
  }
}

function performReload(): void {
  // Emit a distinctive marker before reloading so recovery reloads are
  // observable in logs/RUM — this is how we measure how often the mechanism
  // actually fires in prod (and catch any unexpected spike). It is only ever
  // reached on a genuine chunk-load failure, at most once per session.
  console.warn('[chunkReload] stale-chunk detected — reloading to recover')
  window.location.reload()
}

/**
 * Attempt a guarded recovery reload.
 *
 * @returns `true` if a reload was triggered, `false` if it was skipped (guard set)
 *   or deferred (unsafe state).
 */
export function attemptChunkReload(router?: Router): boolean {
  const storage = window.sessionStorage

  // Loop guard: only ever reload once per session.
  if (guardAlreadySet(storage)) {
    return false
  }

  // Respect unsaved work / active generation — defer rather than destroy.
  if (!isReloadSafe()) {
    armDeferredReload(router)
    return false
  }

  setGuard(storage)
  performReload()
  return true
}

/**
 * Arm a one-shot reload that fires the next time the app reaches a safe state
 * during navigation. Navigation implies the user moved on from the broken view,
 * so reloading then is non-destructive.
 */
function armDeferredReload(router?: Router): void {
  if (!router || deferredReloadArmed) return
  deferredReloadArmed = true

  const stop = router.afterEach(() => {
    const storage = window.sessionStorage
    if (guardAlreadySet(storage)) {
      stop()
      return
    }
    if (isReloadSafe()) {
      stop()
      setGuard(storage)
      performReload()
    }
  })
}

/**
 * Whether an error/rejection looks like a stale-chunk dynamic-import failure.
 */
function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false
  const name = (reason as { name?: unknown }).name
  if (name === 'ChunkLoadError') return true
  const message =
    typeof reason === 'string'
      ? reason
      : ((reason as { message?: unknown }).message ?? '')
  if (typeof message !== 'string') return false
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Unable to preload CSS/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

/**
 * Register global listeners that recover from stale-chunk failures with a
 * guarded reload. Call once during app init.
 */
export function installChunkReload(router?: Router): void {
  // Vite's dedicated event for failed chunk preloads/dynamic imports.
  window.addEventListener('vite:preloadError', () => {
    // Note: telemetry/logging for this event is handled separately (App.vue).
    // We do not preventDefault here — Vite's default is a no-op once the event
    // has fired; our job is purely recovery.
    attemptChunkReload(router)
  })

  // Fallback for dynamic-import rejections that surface as unhandled promise
  // rejections (e.g. a lazy route component import) without the Vite event.
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      attemptChunkReload(router)
    }
  })
}
