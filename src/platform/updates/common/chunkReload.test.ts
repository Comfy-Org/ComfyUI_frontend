import { datadogRum } from '@datadog/browser-rum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const APP_CHUNK = 'https://app.test/assets/settingStore-CUtU9ycZ.js'
const EXTENSION_CHUNK =
  'https://app.test/extensions/RES4LYF/js/RES4LYF_dynamicWidgets.js'

function preloadErrorEvent(url: string): Event {
  const event = new Event('vite:preloadError') as Event & { payload: Error }
  event.payload = new Error(`Failed to fetch dynamically imported module: ${url}`)
  return event
}

describe('chunkReload', () => {
  let reloadSpy: ReturnType<typeof vi.fn>
  const addAction = vi.mocked(datadogRum.addAction)

  beforeEach(() => {
    window.sessionStorage.clear()
    workflowState.modifiedWorkflows = []
    executionState.runningJobIds = []
    addAction.mockClear()

    // location.reload is not implemented under jsdom; stub it. A minimal stub is
    // enough — chunkReload only ever calls window.location.reload().
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://app.test', reload: reloadSpy }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers exactly one reload on a chunk failure when safe', () => {
    const triggered = attemptChunkReload(undefined, APP_CHUNK)

    expect(triggered).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    // A RUM action is emitted so the recovery is observable/aggregatable.
    expect(addAction).toHaveBeenCalledWith('stale-chunk-reload', {
      chunkUrl: APP_CHUNK
    })
    // Guard is persisted so a subsequent failure will not reload again.
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })

  it('does NOT reload a second time once the loop guard is set', () => {
    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    // Second failure in the same session must be a no-op (asset is genuinely gone).
    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(false)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(addAction).toHaveBeenCalledTimes(1)
  })

  it('defers the reload when there are unsaved workflow changes', () => {
    workflowState.modifiedWorkflows = [{ path: 'wf.json' }]

    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    // Guard is NOT set, so recovery can still happen once work is safe.
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })

  it('defers the reload when a generation is running', () => {
    executionState.runningJobIds = ['job-1']

    expect(attemptChunkReload(undefined, APP_CHUNK)).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })

  it('reloads at the next safe navigation after a deferred (dirty) failure', () => {
    let afterEachCb: (() => void) | undefined
    const router = {
      afterEach: (cb: () => void) => {
        afterEachCb = cb
        return vi.fn() // stop handle
      }
    } as unknown as import('vue-router').Router

    workflowState.modifiedWorkflows = [{ path: 'wf.json' }]
    expect(attemptChunkReload(router, APP_CHUNK)).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(afterEachCb).toBeDefined()

    // Navigation happens but still dirty -> no reload yet.
    afterEachCb?.()
    expect(reloadSpy).not.toHaveBeenCalled()

    // Now safe -> reload fires once.
    workflowState.modifiedWorkflows = []
    afterEachCb?.()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })

  it('reloads on a vite:preloadError for an app /assets/ chunk', () => {
    installChunkReload()
    window.dispatchEvent(preloadErrorEvent(APP_CHUNK))

    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(addAction).toHaveBeenCalledWith('stale-chunk-reload', {
      chunkUrl: APP_CHUNK
    })
  })

  it('does NOT reload on a vite:preloadError for an /extensions/ asset', () => {
    installChunkReload()
    window.dispatchEvent(preloadErrorEvent(EXTENSION_CHUNK))

    // Missing custom-node assets are not stale — a reload can't fix them, and
    // they dominate preloadError volume, so recovery must not fire for them.
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(addAction).not.toHaveBeenCalled()
  })

  it('reloads on an unhandledrejection ChunkLoadError for an app chunk', () => {
    installChunkReload()

    const reason = new Error(
      `Failed to fetch dynamically imported module: ${APP_CHUNK}`
    )
    reason.name = 'ChunkLoadError'
    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = reason
    window.dispatchEvent(event)

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('ignores an unhandledrejection for an /extensions/ asset', () => {
    installChunkReload()

    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = new Error(
      `Failed to fetch dynamically imported module: ${EXTENSION_CHUNK}`
    )
    window.dispatchEvent(event)

    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('ignores unrelated unhandledrejections', () => {
    installChunkReload()

    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = new Error('some unrelated error')
    window.dispatchEvent(event)

    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
