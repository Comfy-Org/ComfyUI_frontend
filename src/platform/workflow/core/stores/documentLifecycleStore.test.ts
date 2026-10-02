import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { toRootGraphId } from '@/types/graphScopeId'

import {
  toDocumentUid,
  useDocumentLifecycleStore
} from './documentLifecycleStore'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

describe('useDocumentLifecycleStore', () => {
  const tabA = toDocumentUid('session-a')
  const tabB = toDocumentUid('session-b')

  beforeEach(() => {
    useDocumentLifecycleStore().$reset()
  })

  it('emits one deactivate and activate pair for a document switch', () => {
    const store = useDocumentLifecycleStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })
    listener.mockClear()

    store.beginTransition(tabB)
    store.activate({ uid: tabB, rootGraphId: toRootGraphId('graph-b') })

    expect(listener.mock.calls.map(([event]) => event.phase)).toEqual([
      'deactivate',
      'activate'
    ])
    expect(store.activeRootGraphId(tabB)).toBe(toRootGraphId('graph-b'))
    expect(store.activeRootGraphId(tabA)).toBeNull()
  })

  it('emits no transition for undo, redo, or a same-document reload', () => {
    const store = useDocumentLifecycleStore()
    const listener = vi.fn()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })
    store.subscribe(listener)

    store.beginTransition(tabA)
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    expect(listener).not.toHaveBeenCalled()
  })

  it('fails closed when a replacement load never publishes', () => {
    const store = useDocumentLifecycleStore()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    store.beginTransition(tabB)

    expect(store.activeBinding).toBeNull()
    expect(store.isActive(tabA)).toBe(false)
    expect(store.isActive(tabB)).toBe(false)
  })

  it('treats a reopened path with a new session uid as a new document', () => {
    const store = useDocumentLifecycleStore()
    const reopenedA = toDocumentUid('session-a-reopened')
    const listener = vi.fn()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })
    store.subscribe(listener)

    store.beginTransition(reopenedA)
    store.activate({
      uid: reopenedA,
      rootGraphId: toRootGraphId('graph-a-reopened')
    })

    expect(listener.mock.calls.map(([event]) => event.phase)).toEqual([
      'deactivate',
      'activate'
    ])
    expect(store.isActive(reopenedA)).toBe(true)
  })

  it('isolates listener failures and rejects duplicate registration', () => {
    const store = useDocumentLifecycleStore()
    const broken = vi.fn(() => {
      throw new Error('broken sidecar')
    })
    const healthy = vi.fn()
    store.subscribe(broken)
    store.subscribe(healthy)

    store.subscribe(healthy)
    expect(() =>
      store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })
    ).not.toThrow()
    expect(healthy).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'document_lifecycle_listener_failure',
      surface: 'graph',
      tags: { phase: 'activate' }
    })
    expect(reportError).toHaveBeenCalledWith(
      'Document lifecycle listener is already registered',
      {
        errorType: 'document_lifecycle_duplicate_listener',
        surface: 'graph'
      }
    )
  })
})
