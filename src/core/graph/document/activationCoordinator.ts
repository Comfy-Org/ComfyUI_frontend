import type { DocumentId } from '@/types/documentId'
import { reportError } from '@/platform/telemetry/reportError'

/**
 * View concerns attached by activation and detached by deactivation: the
 * renderer/canvas binding, render-attached caches, viewport projection, and
 * input/event hooks. Attach and detach must not touch semantic document
 * state (ADR-0024: activation is presentation).
 */
export interface DocumentViewBinding {
  attach(documentId: DocumentId): void
  detach(documentId: DocumentId): void
}

export type ActivationOutcome =
  | { status: 'activated'; documentId: DocumentId }
  /** A newer activate/deactivate request won the generation race. */
  | { status: 'superseded'; documentId: DocumentId }
  | {
      status: 'rejected'
      documentId: DocumentId
      reason: 'not-loaded' | 'hydration-failed'
    }

export interface ActivationCoordinatorDeps {
  /** The registry's loaded check for the document being activated. */
  isLoaded(documentId: DocumentId): boolean
  /**
   * Hydrate and validate the document before the handoff. Runs without
   * changing the current binding; a stale request discards this staged work.
   */
  hydrate?(documentId: DocumentId): Promise<void>
}

/**
 * Serializes document activation onto the active-canvas binding (ADR-0024).
 * Requests carry a monotonic generation: a newer request cancels any older
 * in-flight one, and a stale request may clean up its private staged work
 * but can never detach, attach, or publish. The winning request performs one
 * ordered handoff — detach the previous document's view hooks, attach the
 * new document's, publish the new active binding — so a late `activate(A)`
 * completion cannot overwrite a later `activate(B)`.
 */
export function createActivationCoordinator(deps: ActivationCoordinatorDeps) {
  let generation = 0
  let active: { documentId: DocumentId; binding: DocumentViewBinding } | null =
    null

  async function activate(
    documentId: DocumentId,
    binding: DocumentViewBinding
  ): Promise<ActivationOutcome> {
    const requestGeneration = ++generation
    const stale = (): boolean => requestGeneration !== generation
    try {
      await deps.hydrate?.(documentId)
    } catch (error) {
      reportError(error, {
        errorType: 'document-activation-hydration-failed',
        context: { documentId }
      })
      return stale()
        ? { status: 'superseded', documentId }
        : { status: 'rejected', documentId, reason: 'hydration-failed' }
    }
    if (stale()) return { status: 'superseded', documentId }
    if (!deps.isLoaded(documentId))
      return { status: 'rejected', documentId, reason: 'not-loaded' }

    if (active) {
      const previous = active
      active = null
      previous.binding.detach(previous.documentId)
    }
    binding.attach(documentId)
    active = { documentId, binding }
    return { status: 'activated', documentId }
  }

  /**
   * Explicit inverse of {@link activate}. Detaches view concerns only; the
   * document remains loaded and its domain stores, follower, queue, change
   * tracking, and persistence continue to operate.
   */
  function deactivate(documentId: DocumentId): boolean {
    if (active?.documentId !== documentId) return false
    generation++
    active.binding.detach(documentId)
    active = null
    return true
  }

  function activeDocumentId(): DocumentId | null {
    return active?.documentId ?? null
  }

  return { activate, deactivate, activeDocumentId }
}
