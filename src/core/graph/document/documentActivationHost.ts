/**
 * Host-side wiring for the activation seam (ADR-GRAPH-DOCUMENT-0024
 * follow-up 3): the single place that answers "which document is the canvas
 * showing right now".
 *
 * The app reuses one `LGraph` instance across every workflow tab and
 * reconfigures it in place on a switch, so "the graph the canvas holds" is a
 * moving target that no consumer can safely re-derive on its own. This host
 * drives the generation-raced coordinator over that reconfigure and publishes
 * the resulting binding, so op targeting reads one value that changes exactly
 * once per handoff instead of racing the reconfigure.
 */
import type { DocumentId } from '@/types/documentId'
import type { GraphScope, RootGraphId } from '@/types/graphScopeId'

import { createActivationCoordinator } from './activationCoordinator'
import type {
  ActivationOutcome,
  DocumentViewBinding
} from './activationCoordinator'

/** The document whose graph the canvas currently holds. */
interface ActiveDocumentView {
  readonly documentId: DocumentId
  readonly rootGraphId: RootGraphId
  /**
   * The binding that published this view. Only it may retract the view: the
   * coordinator's contract lets it detach a binding it no longer holds, and a
   * document re-activated with a rotated graph id has a newer binding whose
   * view a stale detach must not nullify.
   */
  readonly binding: DocumentViewBinding
}

export interface DocumentActivationHostDeps {
  /**
   * The registry's loaded check, gating the handoff. Loading a document is the
   * load path's own step, taken before it asks for the canvas (see
   * `workflowService.activateLoadedDocument`), so this rejects a document no
   * path has loaded — an unknown or closed one — rather than promoting it.
   */
  isLoaded(documentId: DocumentId): boolean
  /**
   * Record the document's ECS scope in the registry. Called from the winning
   * handoff only: a rejected or superseded activation must not leave its root
   * graph id on the document, because the shared `LGraph` may already carry
   * the winner's id by the time the loser resolves.
   */
  commitScope(documentId: DocumentId, scope: GraphScope): void
}

export interface DocumentActivationHost {
  /**
   * Hand the canvas over to `documentId`'s graph. Resolves once the handoff
   * has run or been superseded by a newer request.
   */
  activate(
    documentId: DocumentId,
    scope: GraphScope
  ): Promise<ActivationOutcome>
  /**
   * Republish the activated document's binding after its root graph id was
   * reminted in place. `LGraph.clear()` mints a fresh root id under the same
   * canvas and the same document (Clear Workflow), so this is a rebind, not a
   * handoff: no detach, no attach, no generation race. Returns false when no
   * document holds the canvas.
   */
  rebindActiveScope(scope: GraphScope): boolean
  /**
   * Detach whichever document the canvas holds, synchronously. Callers invoke
   * this before the shared graph is reconfigured, so no consumer observes a
   * binding that names a graph the canvas no longer shows.
   */
  deactivate(): void
  activeDocumentId(): DocumentId | null
  activeRootGraphId(): RootGraphId | null
}

export function createDocumentActivationHost(
  deps: DocumentActivationHostDeps
): DocumentActivationHost {
  let view: ActiveDocumentView | null = null
  let requested: DocumentId | null = null
  const coordinator = createActivationCoordinator({ isLoaded: deps.isLoaded })

  /**
   * The canvas-side {@link DocumentViewBinding}: attaching publishes the
   * document/graph pair, detaching retracts it. The coordinator owns the
   * ordering, so this only has to be honest about what is published.
   */
  function bindingFor(rootGraphId: RootGraphId): DocumentViewBinding {
    const binding: DocumentViewBinding = {
      attach(documentId) {
        view = { documentId, rootGraphId, binding }
      },
      detach(documentId) {
        if (view?.documentId === documentId && view.binding === binding)
          view = null
      }
    }
    return binding
  }

  return {
    async activate(documentId, scope) {
      requested = documentId
      const outcome = await coordinator.activate(
        documentId,
        bindingFor(scope.rootGraphId)
      )
      if (outcome.status === 'activated') deps.commitScope(documentId, scope)
      return outcome
    },
    rebindActiveScope(scope) {
      if (view === null) return false
      view = { ...view, rootGraphId: scope.rootGraphId }
      deps.commitScope(view.documentId, scope)
      return true
    },
    deactivate() {
      // Retract the in-flight request as well as the published binding. A
      // load that starts while a previous activation is still mid-handoff
      // must not let that activation publish a graph the canvas has already
      // moved past — the window the whole seam exists to close.
      const pending = requested
      requested = null
      const active = coordinator.activeDocumentId()
      if (pending !== null) coordinator.deactivate(pending)
      if (active !== null && active !== pending) coordinator.deactivate(active)
    },
    activeDocumentId: () => coordinator.activeDocumentId(),
    activeRootGraphId: () => view?.rootGraphId ?? null
  }
}
