import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'

import { useGraphDocumentStore } from './graphDocumentStore'

const scope = {
  rootGraphId: toRootGraphId('root-a'),
  owningGraphId: toOwningGraphId('root-a')
}

describe('useGraphDocumentStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('creates local-only documents that are not agent-addressable', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    expect(documentId).not.toBeNull()
    if (documentId === null) return
    const entry = store.getDocument(documentId)
    expect(entry?.workflowId).toBeNull()
    expect(entry?.state.phase).toBe('created')
    expect(store.persistenceStateOf(documentId)).toBe('unsaved')
  })

  it('resolves an agent target by workflow id, never by another key', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument({ workflowId: 'wf-1' })
    expect(documentId).not.toBeNull()
    expect(store.resolveWorkflowTarget('wf-1')?.documentId).toBe(documentId)
    expect(store.resolveWorkflowTarget('wf-other')).toBeNull()
  })

  it('rejects a duplicate workflow id mapping', () => {
    const store = useGraphDocumentStore()
    const first = store.createDocument({ workflowId: 'wf-1' })
    expect(first).not.toBeNull()
    expect(store.createDocument({ workflowId: 'wf-1' })).toBeNull()
    const second = store.createDocument()
    if (second === null) throw new Error('createDocument failed')
    expect(store.assignWorkflowId(second, 'wf-1')).toBe(false)
  })

  it('rejects a stale reassignment of a document that already has a workflow id', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument({ workflowId: 'wf-1' })
    if (documentId === null) throw new Error('createDocument failed')
    expect(store.assignWorkflowId(documentId, 'wf-2')).toBe(false)
    expect(store.assignWorkflowId(documentId, 'wf-1')).toBe(true)
    expect(store.getDocument(documentId)?.workflowId).toBe('wf-1')
  })

  it('allows remapping a workflow id after its previous document closed', () => {
    const store = useGraphDocumentStore()
    const first = store.createDocument({ workflowId: 'wf-1' })
    if (first === null) throw new Error('createDocument failed')
    store.hydrateDocument(first, scope)
    expect(
      store.closeDocument(first, { atRevision: 0, discardChanges: true })
    ).toBe(true)
    expect(store.resolveWorkflowTarget('wf-1')).toBeNull()

    const second = store.createDocument()
    if (second === null) throw new Error('createDocument failed')
    expect(store.assignWorkflowId(second, 'wf-1')).toBe(true)
    expect(store.resolveWorkflowTarget('wf-1')?.documentId).toBe(second)
  })

  it('closes and removes a document whose hydration never ran', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument({ workflowId: 'wf-1' })
    if (documentId === null) throw new Error('createDocument failed')
    expect(
      store.closeDocument(documentId, { atRevision: 0, discardChanges: false })
    ).toBe(false)
    expect(
      store.closeDocument(documentId, { atRevision: 0, discardChanges: true })
    ).toBe(true)
    expect(store.resolveWorkflowTarget('wf-1')).toBeNull()
    expect(store.removeDocument(documentId)).toBe(true)
    expect(store.getDocument(documentId)).toBeNull()
  })

  it('hydration early-binds the scope without requiring a renderer', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument({ workflowId: 'wf-1' })
    if (documentId === null) throw new Error('createDocument failed')
    expect(store.hydrateDocument(documentId, scope)).toBe(true)
    const entry = store.getDocument(documentId)
    expect(entry?.state.phase).toBe('loaded')
    expect(entry?.scope).toEqual(scope)
    expect(store.hydrateDocument(documentId, scope)).toBe(false)
  })

  it('rebinds scope only while loaded', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    if (documentId === null) throw new Error('createDocument failed')
    const rebound = {
      rootGraphId: toRootGraphId('root-b'),
      owningGraphId: toOwningGraphId('root-b')
    }
    expect(store.rebindScope(documentId, rebound)).toBe(false)
    store.hydrateDocument(documentId, scope)
    expect(store.rebindScope(documentId, rebound)).toBe(true)
    expect(store.getDocument(documentId)?.scope).toEqual(rebound)
  })

  it('tracks dirtiness across the save capture boundary', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    if (documentId === null) throw new Error('createDocument failed')
    store.hydrateDocument(documentId, scope)
    store.markMutated(documentId)
    expect(store.persistenceStateOf(documentId)).toBe('unsaved')

    const ticket = store.beginSave(documentId)
    expect(ticket?.revision).toBe(1)
    if (!ticket) return
    store.markMutated(documentId)
    expect(store.completeSave(ticket)).toBe(true)
    expect(store.persistenceStateOf(documentId)).toBe('dirty')

    const secondTicket = store.beginSave(documentId)
    if (!secondTicket) throw new Error('beginSave failed')
    expect(store.completeSave(secondTicket)).toBe(true)
    expect(store.persistenceStateOf(documentId)).toBe('clean')
  })

  it('close is compare-and-set: a stale decision must be re-presented', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    if (documentId === null) throw new Error('createDocument failed')
    store.hydrateDocument(documentId, scope)
    store.markMutated(documentId)
    const presentedRevision =
      store.getDocument(documentId)?.state.revision ?? -1
    const dispose = vi.fn()
    const lease = { graph: {}, dispose }
    store.completeGraphHydration(store.beginGraphHydration(documentId)!, lease)
    store.markMutated(documentId)
    expect(
      store.closeDocument(documentId, {
        atRevision: presentedRevision,
        discardChanges: true
      })
    ).toBe(false)
    expect(store.getDocument(documentId)?.state.phase).toBe('loaded')
    expect(store.graphLeaseOf(documentId)).toBe(lease)
    expect(dispose).not.toHaveBeenCalled()
    expect(
      store.closeDocument(documentId, {
        atRevision: presentedRevision + 1,
        discardChanges: true
      })
    ).toBe(true)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('refuses to close a dirty document without an explicit discard', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    if (documentId === null) throw new Error('createDocument failed')
    store.hydrateDocument(documentId, scope)
    store.markMutated(documentId)
    expect(
      store.closeDocument(documentId, { atRevision: 1, discardChanges: false })
    ).toBe(false)
  })

  it('removes only closed documents and clears their stale mapping', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument({ workflowId: 'wf-1' })
    if (documentId === null) throw new Error('createDocument failed')
    store.hydrateDocument(documentId, scope)
    expect(store.removeDocument(documentId)).toBe(false)
    store.closeDocument(documentId, { atRevision: 0, discardChanges: true })
    expect(store.removeDocument(documentId)).toBe(true)
    expect(store.getDocument(documentId)).toBeNull()
    const next = store.createDocument({ workflowId: 'wf-1' })
    expect(next).not.toBeNull()
  })

  it('isolates state between documents: mutating A never dirties B', () => {
    const store = useGraphDocumentStore()
    const a = store.createDocument({ workflowId: 'wf-a' })
    const b = store.createDocument({ workflowId: 'wf-b' })
    if (a === null || b === null) throw new Error('createDocument failed')
    store.hydrateDocument(a, scope)
    store.hydrateDocument(b, {
      rootGraphId: toRootGraphId('root-b'),
      owningGraphId: toOwningGraphId('root-b')
    })
    store.markMutated(a)
    expect(store.getDocument(a)?.state.revision).toBe(1)
    expect(store.getDocument(b)?.state.revision).toBe(0)
  })

  it('publishes only the newest graph hydration and disposes stale results', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    if (documentId === null) throw new Error('createDocument failed')
    const first = store.beginGraphHydration(documentId)!
    const second = store.beginGraphHydration(documentId)!
    const staleDispose = vi.fn()
    const winningDispose = vi.fn()
    const stale = { graph: { id: 'stale' }, dispose: staleDispose }
    const winning = { graph: { id: 'winning' }, dispose: winningDispose }

    expect(store.completeGraphHydration(first, stale)).toBe(false)
    expect(staleDispose).toHaveBeenCalledOnce()
    expect(store.completeGraphHydration(second, winning)).toBe(true)
    expect(store.graphLeaseOf(documentId)).toBe(winning)
    expect(winningDispose).not.toHaveBeenCalled()
  })

  it('disposes replaced and closed graph leases exactly once', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    if (documentId === null) throw new Error('createDocument failed')
    store.hydrateDocument(documentId, scope)
    const firstDispose = vi.fn()
    const secondDispose = vi.fn()
    store.completeGraphHydration(store.beginGraphHydration(documentId)!, {
      graph: { id: 'first' },
      dispose: firstDispose
    })
    store.completeGraphHydration(store.beginGraphHydration(documentId)!, {
      graph: { id: 'second' },
      dispose: secondDispose
    })

    expect(firstDispose).toHaveBeenCalledOnce()
    expect(
      store.closeDocument(documentId, { atRevision: 0, discardChanges: true })
    ).toBe(true)
    expect(secondDispose).toHaveBeenCalledOnce()
    expect(store.disposeGraphLease(documentId)).toBe(false)
    expect(secondDispose).toHaveBeenCalledOnce()
  })

  it('disposes hydration that completes after close', () => {
    const store = useGraphDocumentStore()
    const documentId = store.createDocument()
    if (documentId === null) throw new Error('createDocument failed')
    const ticket = store.beginGraphHydration(documentId)!
    const dispose = vi.fn()

    expect(
      store.closeDocument(documentId, { atRevision: 0, discardChanges: true })
    ).toBe(true)
    expect(store.completeGraphHydration(ticket, { graph: {}, dispose })).toBe(
      false
    )
    expect(dispose).toHaveBeenCalledOnce()
    expect(store.graphLeaseOf(documentId)).toBeNull()
  })
})
