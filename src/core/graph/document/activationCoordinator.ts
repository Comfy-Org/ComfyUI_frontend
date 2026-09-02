import type { DocumentId } from '@/types/documentId'

/**
 * View concerns attached by activation and detached by deactivation: the
 * renderer/canvas binding, render-attached caches, viewport projection, and
 * input/event hooks. Attach and detach must not touch semantic document
 * state (ADR-0024: activation is presentation).
 *
 * Contract: the coordinator may call `detach` to undo an `attach` that threw
 * or was superseded mid-handoff, so `detach` must tolerate a partially
 * attached binding. A throwing `detach` should best-effort clean up first;
 * the coordinator treats it as detached and never retries it.
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
      reason: 'not-loaded' | 'hydration-failed' | 'handoff-failed'
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
  let pending: { documentId: DocumentId; generation: number } | null = null
  let active: { documentId: DocumentId; binding: DocumentViewBinding } | null =
    null

  async function activate(
    documentId: DocumentId,
    binding: DocumentViewBinding
  ): Promise<ActivationOutcome> {
    const requestGeneration = ++generation
    pending = { documentId, generation: requestGeneration }
    const stale = (): boolean => requestGeneration !== generation
    const finish = (outcome: ActivationOutcome): ActivationOutcome => {
      // Clear only this request's own pending record: a newer activate may
      // have replaced it, and its record must survive this stale finish.
      if (pending?.generation === requestGeneration) pending = null
      return outcome
    }
    try {
      await deps.hydrate?.(documentId)
    } catch {
      return finish(
        stale()
          ? { status: 'superseded', documentId }
          : { status: 'rejected', documentId, reason: 'hydration-failed' }
      )
    }
    if (stale()) return finish({ status: 'superseded', documentId })
    if (!deps.isLoaded(documentId))
      return finish({ status: 'rejected', documentId, reason: 'not-loaded' })

    const previous = active
    active = null
    try {
      if (previous) previous.binding.detach(previous.documentId)
    } catch {
      // A throwing detach must not leave a stale published binding: a later
      // activate/deactivate would detach the old document twice.
      return finish({
        status: 'rejected',
        documentId,
        reason: 'handoff-failed'
      })
    }
    // detach and attach may synchronously re-enter activate/deactivate (e.g.
    // via a store subscriber). The reentrant call wins: re-check staleness
    // around attach so this request never publishes over the winner.
    if (stale()) return finish({ status: 'superseded', documentId })
    try {
      binding.attach(documentId)
    } catch {
      // Best-effort cleanup of hooks a partially-run attach installed; the
      // binding stays unpublished either way.
      try {
        binding.detach(documentId)
      } catch {
        /* treated as detached (DocumentViewBinding contract) */
      }
      return finish({
        status: 'rejected',
        documentId,
        reason: 'handoff-failed'
      })
    }
    if (stale()) {
      // A reentrant call from within attach superseded this request: undo
      // the attach instead of publishing over the winner's state.
      try {
        binding.detach(documentId)
      } catch {
        /* treated as detached (DocumentViewBinding contract) */
      }
      return finish({ status: 'superseded', documentId })
    }
    active = { documentId, binding }
    return finish({ status: 'activated', documentId })
  }

  /**
   * Explicit inverse of {@link activate}. Detaches view concerns only; the
   * document remains loaded and its domain stores, follower, queue, change
   * tracking, and persistence continue to operate.
   */
  function deactivate(documentId: DocumentId): boolean {
    // Cancel an in-flight activate for this document even when it has not
    // been published yet; otherwise the activation would still complete.
    const cancelledInFlight = pending?.documentId === documentId
    if (cancelledInFlight) {
      generation++
      pending = null
    }
    if (active?.documentId !== documentId) return cancelledInFlight
    // Deactivation is targeted: no generation bump here. Every in-flight
    // activate holds a `pending` record (handled above), so bumping the
    // generation for the active branch would only supersede an unrelated
    // in-flight activate of a different document, which must proceed.
    const previous = active
    active = null
    try {
      previous.binding.detach(documentId)
    } catch {
      /* treated as detached (DocumentViewBinding contract) */
    }
    return true
  }

  function activeDocumentId(): DocumentId | null {
    return active?.documentId ?? null
  }

  return { activate, deactivate, activeDocumentId }
}
