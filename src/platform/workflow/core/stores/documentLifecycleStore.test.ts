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
  /** Move the active pointer to this document, as a tab activation does. */
  present(): void
}

describe('useDocumentLifecycleStore', () => {
  /**
   * A document that exists but is not yet on the canvas, so a test can name its
   * uid before presenting it. The store reads only `instanceId` off the active
   * pointer, so the workflow needs no loaded content — hence the single
   * assertion rather than a change tracker (`docs/guidance/typescript.md`
   * forbids a double assertion to make invalid test data compile).
   */
  function openDocument(path: string): TestDocument {
    const workflow = new ComfyWorkflow({ path, modified: 0, size: 0 })
    return {
      uid: toDocumentUid(workflow.instanceId),
      present() {
        useWorkflowStore().activeWorkflow = workflow as LoadedComfyWorkflow
      }
    }
  }

  /**
   * Publish the root graph a completed load for the presented document would.
   * `activate` requires a live token, so open a transition naming the document
   * already on the pointer — a same-document load, which keeps the binding.
   */
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
    // `activateLoadedWorkflow` moves the pointer before `afterLoadNewGraph`
    // publishes, which is the order this mirrors.
    b.present()
    store.activate(toRootGraphId('graph-b'), transition)

    expect(store.activeRootGraphId(b.uid)).toBe(toRootGraphId('graph-b'))
    expect(store.activeRootGraphId(a.uid)).toBeNull()
  })

  it('moves the binding when a tab is activated without a graph load', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    // A pointer move with no graph load. In the app the pointer moves only
    // inside `activateLoadedWorkflow`; the e2e helper `openPersistedWorkflow`
    // moves it directly. Identity follows the pointer, so B now reads the stored
    // id. A uid snapshotted at load completion would still name A and silence
    // the follower
    // (`browser_tests/tests/agent/agentCloseReopenRemoteDelete.spec.ts`).
    b.present()

    expect(store.activeRootGraphId(b.uid)).toBe(toRootGraphId('graph-a'))
    expect(store.activeRootGraphId(a.uid)).toBeNull()
  })

  it('keeps the binding through a same-document reload and refreshes its root graph id', () => {
    const store = useDocumentLifecycleStore()
    a.present()
    publish(toRootGraphId('graph-a'))

    const transition = store.beginTransition(a.uid)
    // The retract is skipped, so nothing else proves the reload was observed:
    // `configure` adopts a fresh root graph id for the same document.
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
    // Published with nothing on the pointer, so the presented uid reads
    // `undefined` as well: without the explicit guard, `presentedUid() === uid`
    // matches two absent sides and hands out the live root graph, failing open
    // into the agent's cross-graph guard.
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

    // An undo of A reloads A, so it keeps the binding; a switch to B starts
    // before the undo finishes and publishes first. The undo then resumes and
    // runs `clean()` + `configure()` on the shared graph, so B's published id
    // no longer names what is on the canvas — and the undo cannot publish its
    // own, because it is no longer the latest load. Neither id is true.
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

    // Same reasoning as the publish case: the failing load cleared the shared
    // graph, so B's published id is no longer known to name the canvas.
    store.invalidate()

    expect(store.isActive(b.uid)).toBe(false)
  })
})
