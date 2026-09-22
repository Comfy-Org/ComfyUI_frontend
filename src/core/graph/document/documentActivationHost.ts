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
}

export interface DocumentActivationHostDeps {
  /** The registry's loaded check, gating the handoff. */
  isLoaded(documentId: DocumentId): boolean
  /**
   * Record the document's ECS scope in the registry. The host is the first
   * caller that knows the root graph id — it reads it off the canvas graph at
   * bind time — so the registry learns the scope here rather than lazily at
   * the document's first agent write.
   */
  bindScope(documentId: DocumentId, scope: GraphScope): void
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
    return {
      attach(documentId) {
        view = { documentId, rootGraphId }
      },
      detach(documentId) {
        if (view?.documentId === documentId) view = null
      }
    }
  }

  return {
    activate(documentId, scope) {
      requested = documentId
      deps.bindScope(documentId, scope)
      return coordinator.activate(documentId, bindingFor(scope.rootGraphId))
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
