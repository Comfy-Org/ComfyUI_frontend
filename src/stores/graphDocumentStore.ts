import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

import {
  initialDocumentState,
  persistenceOf,
  reduceDocument
} from '@/core/graph/document/documentLifecycle'
import type {
  DocumentPersistenceState,
  DocumentTrackingState
} from '@/core/graph/document/documentLifecycle'
import type { DocumentId } from '@/types/documentId'
import { createDocumentId } from '@/types/documentId'
import type { GraphScope } from '@/types/graphScopeId'

export interface GraphDocumentEntry {
  readonly documentId: DocumentId
  /** Canonical cloud wire address, when assigned. Never used as identity. */
  readonly workflowId: string | null
  /** Early-bound ECS scope; set at hydration, independent of any renderer. */
  readonly scope: GraphScope | null
  readonly state: DocumentTrackingState
}

export interface SaveTicket {
  readonly documentId: DocumentId
  /** The exact revision whose serialized bytes the caller captured. */
  readonly revision: number
}

/** Opaque host graph capability owned and disposed by the document registry. */
export interface DocumentGraphLease {
  readonly graph: unknown
  dispose(): void
}

export interface GraphHydrationTicket {
  readonly documentId: DocumentId
  readonly generation: number
}

/**
 * The GraphDocument registry (ADR-0024): every workflow document is a
 * first-class entry keyed by a stable frontend `document_id`, whether or not
 * a tab, renderer, or cloud `workflow_id` exists for it. The registry owns
 * the optional `workflow_id → document_id` mapping and rejects duplicate or
 * stale mappings; agent frames resolve their target here and never fall back
 * to the active canvas.
 */
export const useGraphDocumentStore = defineStore('graphDocument', () => {
  const documents = shallowReactive(new Map<DocumentId, GraphDocumentEntry>())
  const documentIdByWorkflowId = shallowReactive(new Map<string, DocumentId>())
  const graphLeases = new Map<
    DocumentId,
    { generation: number; lease: DocumentGraphLease }
  >()
  const hydrationGenerations = new Map<DocumentId, number>()

  function getDocument(documentId: DocumentId): GraphDocumentEntry | null {
    return documents.get(documentId) ?? null
  }

  function resolveWorkflowTarget(
    workflowId: string
  ): GraphDocumentEntry | null {
    const documentId = documentIdByWorkflowId.get(workflowId)
    if (documentId === undefined) return null
    const entry = documents.get(documentId)
    return entry && entry.state.phase !== 'closed' ? entry : null
  }

  function persistenceStateOf(
    documentId: DocumentId
  ): DocumentPersistenceState | null {
    const entry = documents.get(documentId)
    return entry ? persistenceOf(entry.state) : null
  }

  function graphLeaseOf(documentId: DocumentId): DocumentGraphLease | null {
    return graphLeases.get(documentId)?.lease ?? null
  }

  function beginGraphHydration(
    documentId: DocumentId
  ): GraphHydrationTicket | null {
    const entry = documents.get(documentId)
    if (!entry || entry.state.phase === 'closed') return null
    const generation = (hydrationGenerations.get(documentId) ?? 0) + 1
    hydrationGenerations.set(documentId, generation)
    return { documentId, generation }
  }

  /**
   * Publish only the newest hydration result. Replaced and stale leases are
   * disposed exactly once by registry ownership.
   */
  function completeGraphHydration(
    ticket: GraphHydrationTicket,
    lease: DocumentGraphLease
  ): boolean {
    const entry = documents.get(ticket.documentId)
    if (
      !entry ||
      entry.state.phase === 'closed' ||
      hydrationGenerations.get(ticket.documentId) !== ticket.generation
    ) {
      lease.dispose()
      return false
    }
    const previous = graphLeases.get(ticket.documentId)
    graphLeases.set(ticket.documentId, {
      generation: ticket.generation,
      lease
    })
    if (previous && previous.lease !== lease) previous.lease.dispose()
    return true
  }

  function disposeGraphLease(documentId: DocumentId): boolean {
    const current = graphLeases.get(documentId)
    if (!current) return false
    graphLeases.delete(documentId)
    current.lease.dispose()
    return true
  }

  function patch(
    documentId: DocumentId,
    changes: Partial<Omit<GraphDocumentEntry, 'documentId'>>
  ): GraphDocumentEntry | null {
    const entry = documents.get(documentId)
    if (!entry) return null
    const next = { ...entry, ...changes }
    documents.set(documentId, next)
    return next
  }

  function createDocument(options?: {
    workflowId?: string
  }): DocumentId | null {
    const workflowId = options?.workflowId ?? null
    if (workflowId !== null && resolveWorkflowTarget(workflowId) !== null)
      return null
    const documentId = createDocumentId()
    documents.set(documentId, {
      documentId,
      workflowId,
      scope: null,
      state: initialDocumentState
    })
    if (workflowId !== null) documentIdByWorkflowId.set(workflowId, documentId)
    return documentId
  }

  /**
   * Map a cloud `workflow_id` onto an existing document. Rejects a duplicate
   * mapping (the workflow id already addresses another live document) and a
   * stale reassignment (the document already carries a different workflow id).
   */
  function assignWorkflowId(
    documentId: DocumentId,
    workflowId: string
  ): boolean {
    const entry = documents.get(documentId)
    if (!entry || entry.state.phase === 'closed') return false
    if (entry.workflowId === workflowId) return true
    if (entry.workflowId !== null) return false
    const incumbent = resolveWorkflowTarget(workflowId)
    if (incumbent !== null && incumbent.documentId !== documentId) return false
    documentIdByWorkflowId.set(workflowId, documentId)
    patch(documentId, { workflowId })
    return true
  }

  /** Transition `created → loaded` and early-bind the document's ECS scope. */
  function hydrateDocument(documentId: DocumentId, scope: GraphScope): boolean {
    const entry = documents.get(documentId)
    if (!entry) return false
    const state = reduceDocument(entry.state, { type: 'hydrated' })
    if (state === entry.state || state.phase !== 'loaded') return false
    patch(documentId, { state, scope })
    return true
  }

  /** Rebind the loaded document's scope, e.g. after its graph id is reminted. */
  function rebindScope(documentId: DocumentId, scope: GraphScope): boolean {
    const entry = documents.get(documentId)
    if (!entry || entry.state.phase !== 'loaded') return false
    patch(documentId, { scope })
    return true
  }

  function markMutated(documentId: DocumentId): boolean {
    const entry = documents.get(documentId)
    if (!entry) return false
    const state = reduceDocument(entry.state, { type: 'mutated' })
    if (state === entry.state) return false
    patch(documentId, { state })
    return true
  }

  /**
   * Capture the save point. The caller serializes the document's bytes at
   * this exact revision before starting I/O, then reports `completeSave`
   * with the ticket. Mutations committed in between leave the document dirty.
   */
  function beginSave(documentId: DocumentId): SaveTicket | null {
    const entry = documents.get(documentId)
    if (!entry || entry.state.phase === 'closed') return null
    return { documentId, revision: entry.state.revision }
  }

  function completeSave(ticket: SaveTicket): boolean {
    const entry = documents.get(ticket.documentId)
    if (!entry) return false
    const state = reduceDocument(entry.state, {
      type: 'saveCompleted',
      atRevision: ticket.revision
    })
    if (state === entry.state) return false
    patch(ticket.documentId, { state })
    return true
  }

  /**
   * Compare-and-set close over an exact revision. Returns false when the
   * decision is stale (the live revision moved) or the document is dirty
   * without an explicit discard; the caller must re-present the decision.
   */
  function closeDocument(
    documentId: DocumentId,
    decision: { atRevision: number; discardChanges: boolean }
  ): boolean {
    const entry = documents.get(documentId)
    if (!entry) return false
    const state = reduceDocument(entry.state, {
      type: 'closed',
      atRevision: decision.atRevision,
      discardChanges: decision.discardChanges
    })
    if (state.phase !== 'closed' || entry.state.phase === 'closed') return false
    // Invalidate in-flight hydration before disposing the published lease.
    hydrationGenerations.set(
      documentId,
      (hydrationGenerations.get(documentId) ?? 0) + 1
    )
    disposeGraphLease(documentId)
    patch(documentId, { state, scope: null })
    return true
  }

  /** Drop a closed document's registry entry and its stale mapping. */
  function removeDocument(documentId: DocumentId): boolean {
    const entry = documents.get(documentId)
    if (!entry || entry.state.phase !== 'closed') return false
    if (
      entry.workflowId !== null &&
      documentIdByWorkflowId.get(entry.workflowId) === documentId
    )
      documentIdByWorkflowId.delete(entry.workflowId)
    documents.delete(documentId)
    hydrationGenerations.delete(documentId)
    return true
  }

  return {
    createDocument,
    getDocument,
    resolveWorkflowTarget,
    persistenceStateOf,
    graphLeaseOf,
    beginGraphHydration,
    completeGraphHydration,
    disposeGraphLease,
    assignWorkflowId,
    hydrateDocument,
    rebindScope,
    markMutated,
    beginSave,
    completeSave,
    closeDocument,
    removeDocument
  }
})
