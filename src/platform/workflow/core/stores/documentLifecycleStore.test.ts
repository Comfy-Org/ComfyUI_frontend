import { beforeEach, describe, expect, it } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { RootGraphId } from '@/types/graphScopeId'
import { toRootGraphId } from '@/types/graphScopeId'

import type { DocumentUid } from './documentLifecycleStore'
import {
  toDocumentUid,
  useDocumentLifecycleStore
} from './documentLifecycleStore'

interface TestDocument {
  readonly uid: DocumentUid
  present(): void
}

describe('useDocumentLifecycleStore', () => {
  function openDocument(path: string): TestDocument {
    const workflow = new ComfyWorkflow({ path, modified: 0, size: 0 })
    return {
      uid: toDocumentUid(workflow.instanceId),
      present() {
        useWorkflowStore().activeWorkflow = workflow as LoadedComfyWorkflow
      }
    }
  }

  function publish(rootGraphId: RootGraphId): void {
    const store = useDocumentLifecycleStore()
    const active = useWorkflowStore().activeWorkflow
    store.activate(
      rootGraphId,
      store.beginTransition(active ? toDocumentUid(active.instanceId) : null)
    )
  }

  let a: TestDocument
  let b: TestDocument

  beforeEach(() => {
    useDocumentLifecycleStore().$reset()
    useWorkflowStore().activeWorkflow = null
    a = openDocument('workflows/a.json')
    b = openDocument('workflows/b.json')
  })

  it('hands the binding over on a document switch', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    const transition = store.beginTransition(b.uid)
    b.present()
    store.activate(toRootGraphId('graph-b'), transition)

    expect(store.activeRootGraphId(b.uid)).toBe(toRootGraphId('graph-b'))
    expect(store.activeRootGraphId(a.uid)).toBeNull()
  })

  it('moves the binding when a tab is activated without a graph load', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    b.present()

    expect(store.activeRootGraphId(b.uid)).toBe(toRootGraphId('graph-a'))
    expect(store.activeRootGraphId(a.uid)).toBeNull()
  })

  it('keeps the binding through a same-document reload and refreshes its root graph id', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    const transition = store.beginTransition(a.uid)
    expect(store.isActive(a.uid)).toBe(true)
    store.activate(toRootGraphId('graph-a-reloaded'), transition)

    expect(store.activeRootGraphId(a.uid)).toBe(
      toRootGraphId('graph-a-reloaded')
    )
  })

  it('fails closed when a replacement load never publishes', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    store.beginTransition(b.uid)

    expect(store.isActive(a.uid)).toBe(false)
    b.present()
    expect(store.isActive(b.uid)).toBe(false)
  })

  it('fails closed when a same-document reload fails after clearing the graph', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    store.beginTransition(a.uid)
    store.invalidate()

    expect(store.isActive(a.uid)).toBe(false)
  })

  it('reports nothing active for a workflow carrying no session uid', () => {
    const store = useDocumentLifecycleStore()
    publish(toRootGraphId('graph-a'))

    expect(store.isActive(undefined)).toBe(false)
    expect(store.activeRootGraphId(undefined)).toBeNull()
  })

  it('follows an in-place root graph rotation without changing document', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    store.rebindActiveRootGraph(toRootGraphId('graph-a-rotated'))

    expect(store.isActive(a.uid)).toBe(true)
    expect(store.activeRootGraphId(a.uid)).toBe(
      toRootGraphId('graph-a-rotated')
    )
  })

  it('ignores a root graph rotation while no document is bound', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))
    store.beginTransition(b.uid)

    store.rebindActiveRootGraph(toRootGraphId('graph-orphan'))

    expect(store.isActive(a.uid)).toBe(false)
    b.present()
    expect(store.activeRootGraphId(b.uid)).toBeNull()
  })

  it('retracts when a superseded load publishes after rewriting the canvas', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    const undoOfA = store.beginTransition(a.uid)
    const switchToB = store.beginTransition(b.uid)
    b.present()
    store.activate(toRootGraphId('graph-b'), switchToB)
    store.activate(toRootGraphId('graph-a-stale'), undoOfA)

    expect(store.activeRootGraphId(b.uid)).toBeNull()
    expect(store.activeRootGraphId(a.uid)).toBeNull()
  })

  it('retracts when a superseded load fails after clearing the graph', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    store.beginTransition(null)
    const switchToB = store.beginTransition(b.uid)
    b.present()
    store.activate(toRootGraphId('graph-b'), switchToB)

    store.invalidate()

    expect(store.isActive(b.uid)).toBe(false)
  })
})
