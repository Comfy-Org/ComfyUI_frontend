import { datadogRum } from '@datadog/browser-rum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import {
  CHUNK_RELOAD_GUARD_KEY,
  attemptChunkReload,
  installChunkReload
} from '@/platform/updates/common/chunkReload'

// Mutable store state controlled per-test.
const workflowState = { modifiedWorkflows: [] as unknown[] }
const executionState = { runningJobIds: [] as unknown[] }

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => workflowState
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => executionState
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addAction: vi.fn() }
}))

// Recovery is asserted two ways: `datadogRum.addAction` (emitted immediately
// before the reload — a clean module mock) and `window.location.reload` itself,
// overridden here on the live location object. Both fire in every path, including
// event-listener and router-callback contexts, once per-test isolation is kept
// tight (see the beforeEach/afterEach listener + sessionStorage handling below).
const mockReload = vi.fn()

const APP_CHUNK = 'http://localhost/assets/settingStore-CUtU9ycZ.js'
const EXTENSION_CHUNK =
  'http://localhost/extensions/RES4LYF/js/RES4LYF_dynamicWidgets.js'

function preloadErrorEvent(url: string): Event {
  const event = new Event('vite:preloadError') as Event & { payload: Error }
  event.payload = new Error(
    `Failed to fetch dynamically imported module: ${url}`
  )
  return event
}

describe('chunkReload', () => {
  const addAction = vi.mocked(datadogRum.addAction)

  // `installChunkReload` registers global `window` listeners with no exposed
  // handle to remove them. Track every listener each test installs and tear them
  // down in `afterEach`, so listeners never accumulate across tests on the shared
  // `window` (which would let a later dispatch re-enter a previous test's handler).
  const installedListeners: Array<
    [string, EventListenerOrEventListenerObject]
  > = []
  const realAddEventListener = window.addEventListener.bind(window)

  beforeEach(() => {
    window.sessionStorage.clear()
    workflowState.modifiedWorkflows = []
    executionState.runningJobIds = []
    mockReload.mockClear()
    addAction.mockClear()
    installedListeners.length = 0
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type, listener, options) => {
        installedListeners.push([type, listener])
        return realAddEventListener(type, listener, options)
      }
    )
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      writable: true,
      value: mockReload
    })
  })

  afterEach(() => {
    for (const [type, listener] of installedListeners) {
      window.removeEventListener(type, listener)
    }
    installedListeners.length = 0
    vi.restoreAllMocks()
  })

  it('triggers exactly one reload on a chunk failure when safe', () => {
    const triggered = attemptChunkReload(undefined, APP_CHUNK)

    expect(triggered).toBe(true)
    // A RUM action is emitted so the recovery is observable/aggregatable.
    expect(addAction).toHaveBeenCalledWith('stale-chunk-reload', {
      chunkUrl: APP_CHUNK
    })
    // Direct-call path: the actual reload fires too.
    expect(mockReload).toHaveBeenCalledTimes(1)
    // Guard is persisted so a subsequent failure will not reload again.
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })

  it('does NOT trigger a second recovery once the loop guard is set', () => {
    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(true)
    expect(addAction).toHaveBeenCalledTimes(1)

    // Second failure in the same session must be a no-op (asset is genuinely gone).
    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(false)
    expect(addAction).toHaveBeenCalledTimes(1)
  })

  it('defers recovery when there are unsaved workflow changes', () => {
    workflowState.modifiedWorkflows = [{ path: 'wf.json' }]

    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(false)
    expect(addAction).not.toHaveBeenCalled()
    // Guard is NOT set, so recovery can still happen once work is safe.
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })

  it('does not recover if the loop guard cannot be persisted', () => {
    // Storage is readable (getItem -> null) but writes fail (e.g. quota). Without
    // a stored guard a reload could loop, so we must not reload.
    //
    // happy-dom's `sessionStorage` is a Proxy that caches the real `setItem`
    // after the first call, so neither `vi.spyOn(window.sessionStorage, ...)`
    // (which the proxy blocks from being un-installed, leaking the stub into
    // later tests) nor `vi.spyOn(Storage.prototype, ...)` (silently ignored once
    // any earlier test has written the guard) works here. Instead we install a
    // throwing override as an own property on the instance and restore the
    // original explicitly in `finally` — the only combination that both takes
    // effect and stays isolated (a plain `delete` is rejected by the proxy).
    const originalSetItem = window.sessionStorage.setItem
    Object.defineProperty(window.sessionStorage, 'setItem', {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error('quota exceeded')
      }
    })
    try {
      expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(false)
      expect(addAction).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window.sessionStorage, 'setItem', {
        configurable: true,
        writable: true,
        value: originalSetItem
      })
    }
  })

  it('defers recovery when a generation is running', () => {
    executionState.runningJobIds = ['job-1']

    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(false)
    expect(addAction).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })

  it('recovers at the next safe navigation after a deferred (dirty) failure', () => {
    let afterEachCb: (() => void) | undefined
    const router = {
      afterEach: (cb: () => void) => {
        afterEachCb = cb
        return vi.fn() // stop handle
      }
    } as unknown as Router

    workflowState.modifiedWorkflows = [{ path: 'wf.json' }]
    expect(attemptChunkReload(router, APP_CHUNK)).toBe(false)
    expect(addAction).not.toHaveBeenCalled()
    expect(afterEachCb).toBeDefined()

    // Navigation happens but still dirty -> no recovery yet.
    afterEachCb?.()
    expect(addAction).not.toHaveBeenCalled()

    // Now safe -> recovery fires once (RUM signal + the actual reload).
    workflowState.modifiedWorkflows = []
    afterEachCb?.()
    expect(addAction).toHaveBeenCalledTimes(1)
    expect(mockReload).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })

  it('recovers on a vite:preloadError for an app /assets/ chunk', () => {
    installChunkReload()
    window.dispatchEvent(preloadErrorEvent(APP_CHUNK))

    expect(addAction).toHaveBeenCalledWith('stale-chunk-reload', {
      chunkUrl: APP_CHUNK
    })
    // Exactly one reload lands the user on the current version.
    expect(mockReload).toHaveBeenCalledTimes(1)
  })

  it('does NOT recover on a vite:preloadError for an /extensions/ asset', () => {
    installChunkReload()
    window.dispatchEvent(preloadErrorEvent(EXTENSION_CHUNK))

    // Missing custom-node assets are not stale — a reload can't fix them, and
    // they dominate preloadError volume, so recovery must not fire for them.
    expect(addAction).not.toHaveBeenCalled()
  })

  it('recovers on an unhandledrejection ChunkLoadError for an app chunk', () => {
    installChunkReload()

    const reason = new Error(
      `Failed to fetch dynamically imported module: ${APP_CHUNK}`
    )
    reason.name = 'ChunkLoadError'
    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = reason
    window.dispatchEvent(event)

    expect(addAction).toHaveBeenCalledTimes(1)
    expect(mockReload).toHaveBeenCalledTimes(1)
  })

  it('ignores an unhandledrejection for an /extensions/ asset', () => {
    installChunkReload()

    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = new Error(
      `Failed to fetch dynamically imported module: ${EXTENSION_CHUNK}`
    )
    window.dispatchEvent(event)

    expect(addAction).not.toHaveBeenCalled()
  })

  it('ignores unrelated unhandledrejections', () => {
    installChunkReload()

    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = new Error('some unrelated error')
    window.dispatchEvent(event)

    expect(addAction).not.toHaveBeenCalled()
  })
})
