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

describe('chunkReload', () => {
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.sessionStorage.clear()
    workflowState.modifiedWorkflows = []
    executionState.runningJobIds = []

    // location.reload is not implemented/allowed under jsdom; replace it.
    // A minimal stub is sufficient — chunkReload only ever calls
    // window.location.reload(), and jsdom's Location props are prototype getters
    // (not own-enumerable), so spreading the instance would copy nothing anyway.
    reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: reloadSpy }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers exactly one reload on a chunk failure when safe', () => {
    const triggered = attemptChunkReload()

    expect(triggered).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    // Guard is persisted so a subsequent failure will not reload again.
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })

  it('does NOT reload a second time once the loop guard is set', () => {
    // First failure reloads.
    expect(attemptChunkReload()).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    // Second failure in the same session must be a no-op (asset is genuinely gone).
    const second = attemptChunkReload()
    expect(second).toBe(false)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('defers the reload when there are unsaved workflow changes', () => {
    workflowState.modifiedWorkflows = [{ path: 'wf.json' }]

    const triggered = attemptChunkReload()

    expect(triggered).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    // Guard is NOT set, so recovery can still happen once work is safe.
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBeNull()
  })

  it('defers the reload when a generation is running', () => {
    executionState.runningJobIds = ['job-1']

    const triggered = attemptChunkReload()

    expect(triggered).toBe(false)
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

    // Dirty at failure time -> defer and arm a router hook.
    workflowState.modifiedWorkflows = [{ path: 'wf.json' }]
    expect(attemptChunkReload(router)).toBe(false)
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(afterEachCb).toBeDefined()

    // Navigation happens but still dirty -> no reload yet.
    afterEachCb?.()
    expect(reloadSpy).not.toHaveBeenCalled()

    // User saves / navigates away, now safe -> reload fires once.
    workflowState.modifiedWorkflows = []
    afterEachCb?.()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).not.toBeNull()
  })

  it('installChunkReload reloads on a vite:preloadError event', () => {
    installChunkReload()

    const event = new Event('vite:preloadError') as Event & { payload: Error }
    event.payload = new Error(
      'Failed to fetch dynamically imported module: /assets/x.js'
    )
    window.dispatchEvent(event)

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('installChunkReload reloads on an unhandledrejection ChunkLoadError', () => {
    installChunkReload()

    const reason = new Error('boom')
    reason.name = 'ChunkLoadError'
    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = reason
    window.dispatchEvent(event)

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('installChunkReload ignores unrelated unhandledrejections', () => {
    installChunkReload()

    const event = new Event('unhandledrejection') as Event & { reason: unknown }
    event.reason = new Error('some unrelated error')
    window.dispatchEvent(event)

    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
