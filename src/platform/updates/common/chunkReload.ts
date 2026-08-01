import { datadogRum } from '@datadog/browser-rum'
import type { Router } from 'vue-router'

import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

/**
 * Recover from stale-chunk failures automatically.
 *
 * After a new frontend deploys, a previously-loaded `index.html` may reference
 * hashed JS/CSS chunks that no longer exist. A subsequent dynamic import then
 * fails with Vite's `vite:preloadError` event (or a `ChunkLoadError` rejection),
 * producing a white screen. Because `index.html` is always served fresh, a
 * single `location.reload()` pulls the current, self-consistent version.
 *
 * Scope — **app chunks only.** Prod RUM shows `vite:preloadError` is dominated
 * (~30:1) by missing `/extensions/*` custom-node assets, which a reload cannot
 * fix (they are absent, not stale). Reloading for those just churns the user, so
 * recovery is limited to the versioned, content-hashed `/assets/*` app chunks —
 * the only case a reload actually resolves.
 *
 * Safeguards:
 *  - A `sessionStorage` loop-guard reloads at most once per session, so a
 *    genuinely-missing asset never traps the user in a reload loop.
 *  - Unsaved-edit / active-generation awareness defers the reload (and fires it
 *    at the next safe navigation) so user work is never blown away.
 */

/** sessionStorage key marking that we have already attempted a recovery reload. */
export const CHUNK_RELOAD_GUARD_KEY = 'comfy:chunk-reload-attempted'

function guardAlreadySet(storage: Storage): boolean {
  try {
    return storage.getItem(CHUNK_RELOAD_GUARD_KEY) !== null
  } catch {
    // sessionStorage unavailable (e.g. privacy mode): treat the guard as set so
    // we never risk a reload loop.
    return true
  }
}

function setGuard(storage: Storage): boolean {
  try {
    storage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))
    return true
  } catch {
    // Could not persist the guard (e.g. storage quota). Do NOT reload — without
    // a stored guard a still-broken page would reload endlessly. Favor a visible
    // error over a reload loop.
    return false
  }
}

/**
 * Whether reloading now is safe (no unsaved edits and no active generation).
 * Dirty state uses the same signal as the beforeunload confirmation
 * (`workflowStore.modifiedWorkflows`); active generation via the execution store.
 */
function isReloadSafe(): boolean {
  try {
    const workflowStore = useWorkflowStore()
    if (workflowStore.modifiedWorkflows.length > 0) return false

    const executionStore = useExecutionStore()
    if (executionStore.runningJobIds.length > 0) return false

    return true
  } catch {
    // Stores not ready — cannot prove safety; do not interrupt the user.
    return false
  }
}

/**
 * Narrow an `unknown` error/rejection reason to its message string, without
 * `as` assertions: a raw string reason is itself the message; an object with a
 * string `message` yields that. Anything else has no usable message.
 */
function getErrorMessage(reason: unknown): string | undefined {
  if (typeof reason === 'string') return reason
  if (
    typeof reason === 'object' &&
    reason !== null &&
    'message' in reason &&
    typeof reason.message === 'string'
  ) {
    return reason.message
  }
  return undefined
}

/** Extract the failing module URL from a preload/chunk error. */
function extractModuleUrl(reason: unknown): string | undefined {
  if (!reason) return undefined
  if (typeof reason === 'object' && 'url' in reason) {
    const direct = reason.url
    if (typeof direct === 'string' && direct) return direct
  }
  const message = getErrorMessage(reason)
  if (message === undefined) return undefined
  return message.match(/https?:\/\/[^\s"')]+|\/[^\s"')]+/)?.[0]
}

/**
 * Only same-origin `/assets/*` app chunks are recoverable by a reload. Missing
 * `/extensions/*` or `/scripts/*` assets are absent, not stale — reloading won't
 * bring them back. When the URL can't be determined, err on the side of NOT
 * reloading (the unknown/undetermined cases are overwhelmingly extensions).
 */
function isRecoverableChunkUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    // We only care about the path — app chunks live under /assets/. A throwaway
    // base lets a relative URL parse; for an absolute URL the base is ignored.
    // (App chunks are same-origin by nature, and reloading the current page is
    // benign regardless, so a strict origin check would add nothing here.)
    return new URL(url, 'http://localhost').pathname.startsWith('/assets/')
  } catch {
    return false
  }
}

function performReload(chunkUrl?: string): void {
  // First-class, aggregatable telemetry: a RUM custom action fired only on a
  // genuine app-chunk staleness recovery (at most once per session). This is how
  // we measure real-world reload frequency and alert if it ever spikes. Wrapped
  // so a throwing/uninitialized RUM SDK can never block the reload — recovery is
  // the whole point of this path and must always proceed.
  try {
    datadogRum.addAction('stale-chunk-reload', { chunkUrl })
  } catch {
    // Telemetry must never prevent the recovery reload.
  }
  window.location.reload()
}

/**
 * Attempt a guarded recovery reload.
 *
 * @returns `true` if a reload was triggered, `false` if skipped (guard set) or
 *   deferred (unsafe state).
 */
export function attemptChunkReload(
  router?: Router,
  chunkUrl?: string
): boolean {
  const storage = window.sessionStorage

  // Loop guard: only ever reload once per session.
  if (guardAlreadySet(storage)) return false

  // Respect unsaved work / active generation — defer rather than destroy.
  if (!isReloadSafe()) {
    armDeferredReload(router, chunkUrl)
    return false
  }

  if (!setGuard(storage)) return false
  performReload(chunkUrl)
  return true
}

/**
 * Arm a one-shot reload that fires the next time the app reaches a safe state
 * during navigation (navigation implies the user moved on from the broken view).
 */
function armDeferredReload(router?: Router, chunkUrl?: string): void {
  if (!router) return

  // The sessionStorage guard already caps recovery at one reload per session, so
  // if multiple deferred errors register a hook each, only the first to reach a
  // safe navigation reloads; the rest see the guard set and remove themselves.
  const stop = router.afterEach(() => {
    const storage = window.sessionStorage
    if (guardAlreadySet(storage)) {
      stop()
      return
    }
    if (isReloadSafe()) {
      stop()
      if (setGuard(storage)) performReload(chunkUrl)
    }
  })
}

/** Whether a rejection looks like a stale-chunk dynamic-import failure. */
function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false
  if (
    typeof reason === 'object' &&
    'name' in reason &&
    reason.name === 'ChunkLoadError'
  ) {
    return true
  }
  const message = getErrorMessage(reason)
  if (message === undefined) return false
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Unable to preload CSS/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

/**
 * Register global listeners that recover from stale *app-chunk* failures with a
 * guarded reload. Call once during app init (cloud distribution only).
 */
export function installChunkReload(router?: Router): void {
  // Vite's dedicated event for failed chunk preloads/dynamic imports.
  window.addEventListener('vite:preloadError', (event) => {
    const reason = (event as { payload?: unknown }).payload ?? event
    const url = extractModuleUrl(reason)
    if (isRecoverableChunkUrl(url)) attemptChunkReload(router, url)
  })

  // Fallback for dynamic-import rejections that surface as unhandled promise
  // rejections without the Vite event.
  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return
    const url = extractModuleUrl(event.reason)
    if (isRecoverableChunkUrl(url)) attemptChunkReload(router, url)
  })
}
