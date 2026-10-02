import { beforeEach, describe, expect, it } from 'vitest'

import { toRootGraphId } from '@/types/graphScopeId'

import {
  toDocumentUid,
  useDocumentLifecycleStore
} from './documentLifecycleStore'

describe('useDocumentLifecycleStore', () => {
  const tabA = toDocumentUid('session-a')
  const tabB = toDocumentUid('session-b')

  beforeEach(() => {
    useDocumentLifecycleStore().$reset()
  })

  it('hands the binding over on a document switch', () => {
    const store = useDocumentLifecycleStore()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    const transition = store.beginTransition(tabB)
    store.activate(
      { uid: tabB, rootGraphId: toRootGraphId('graph-b') },
      transition
    )

    expect(store.activeRootGraphId(tabB)).toBe(toRootGraphId('graph-b'))
    expect(store.activeRootGraphId(tabA)).toBeNull()
  })

  it('keeps the binding through a same-document reload and refreshes its root graph id', () => {
    const store = useDocumentLifecycleStore()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    const transition = store.beginTransition(tabA)
    // The retract is skipped, so nothing else proves the reload was observed:
    // `configure` adopts a fresh root graph id for the same document.
    expect(store.isActive(tabA)).toBe(true)
    store.activate(
      { uid: tabA, rootGraphId: toRootGraphId('graph-a-reloaded') },
      transition
    )

    expect(store.activeRootGraphId(tabA)).toBe(
      toRootGraphId('graph-a-reloaded')
    )
  })

  it('fails closed when a replacement load never publishes', () => {
    const store = useDocumentLifecycleStore()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    store.beginTransition(tabB)

    expect(store.isActive(tabA)).toBe(false)
    expect(store.isActive(tabB)).toBe(false)
  })

  it('fails closed when a same-document reload fails after clearing the graph', () => {
    const store = useDocumentLifecycleStore()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    const transition = store.beginTransition(tabA)
    store.invalidate(transition)

    expect(store.isActive(tabA)).toBe(false)
  })

  it('reports nothing active for a workflow carrying no session uid', () => {
    const store = useDocumentLifecycleStore()

    // `binding?.uid === uid` is true when both sides are undefined, which
    // fails open into the agent's cross-graph guard.
    expect(store.isActive(undefined)).toBe(false)
    expect(store.activeRootGraphId(undefined)).toBeNull()
  })

  it('follows an in-place root graph rotation without changing document', () => {
    const store = useDocumentLifecycleStore()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    store.rebindActiveRootGraph(toRootGraphId('graph-a-rotated'))

    expect(store.isActive(tabA)).toBe(true)
    expect(store.activeRootGraphId(tabA)).toBe(toRootGraphId('graph-a-rotated'))
  })

  it('ignores a root graph rotation while no document is bound', () => {
    const store = useDocumentLifecycleStore()
    store.beginTransition(tabB)

    store.rebindActiveRootGraph(toRootGraphId('graph-orphan'))

    expect(store.isActive(tabB)).toBe(false)
    expect(store.activeRootGraphId(tabB)).toBeNull()
  })

  it('drops a publish from a load a newer load has superseded', () => {
    const store = useDocumentLifecycleStore()
    store.activate({ uid: tabA, rootGraphId: toRootGraphId('graph-a') })

    // An undo of A reloads A, so it keeps the binding; a switch to B starts
    // before the undo finishes and configures the shared graph first.
    const undoOfA = store.beginTransition(tabA)
    const switchToB = store.beginTransition(tabB)
    store.activate(
      { uid: tabB, rootGraphId: toRootGraphId('graph-b') },
      switchToB
    )
    store.activate(
      { uid: tabA, rootGraphId: toRootGraphId('graph-b') },
      undoOfA
    )

    expect(store.isActive(tabB)).toBe(true)
    expect(store.activeRootGraphId(tabB)).toBe(toRootGraphId('graph-b'))
  })

  it('drops a retraction from a load a newer load has superseded', () => {
    const store = useDocumentLifecycleStore()
    const failingLoad = store.beginTransition(null)
    const switchToB = store.beginTransition(tabB)
    store.activate(
      { uid: tabB, rootGraphId: toRootGraphId('graph-b') },
      switchToB
    )

    store.invalidate(failingLoad)

    expect(store.isActive(tabB)).toBe(true)
  })
})
