import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import type { RootGraphId } from '@/types/graphScopeId'

export type DocumentUid = string & { readonly __brand: 'DocumentUid' }

export function toDocumentUid(value: string): DocumentUid {
  return value as DocumentUid
}

interface ActiveDocumentBinding {
  readonly uid: DocumentUid
  readonly rootGraphId: RootGraphId
}

type DocumentTransitionEvent =
  | { readonly phase: 'deactivate'; readonly binding: ActiveDocumentBinding }
  | { readonly phase: 'activate'; readonly binding: ActiveDocumentBinding }

type DocumentTransitionListener = (event: DocumentTransitionEvent) => void

/**
 * Owns the one fact that the shared canvas cannot answer for itself: which
 * workflow document its root graph currently represents.
 */
export const useDocumentLifecycleStore = defineStore(
  'documentLifecycle',
  () => {
    const activeBinding = shallowRef<ActiveDocumentBinding | null>(null)
    const listeners = new Set<DocumentTransitionListener>()

    function emit(event: DocumentTransitionEvent): void {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (error) {
          reportError(error, {
            errorType: 'document_lifecycle_listener_failure',
            surface: 'graph',
            tags: { phase: event.phase }
          })
        }
      }
    }

    function deactivate(): void {
      const outgoing = activeBinding.value
      if (outgoing === null) return
      activeBinding.value = null
      emit({ phase: 'deactivate', binding: outgoing })
    }

    /**
     * Retract the current binding only when a graph load is changing document.
     * Undo, redo, and same-document reloads retain their binding.
     */
    function beginTransition(nextUid: DocumentUid | null): void {
      if (activeBinding.value?.uid === nextUid) return
      deactivate()
    }

    /** Publish a successfully configured live root graph. */
    function activate(binding: ActiveDocumentBinding): void {
      const current = activeBinding.value
      if (current?.uid === binding.uid) {
        activeBinding.value = binding
        return
      }
      deactivate()
      activeBinding.value = binding
      emit({ phase: 'activate', binding })
    }

    function isActive(uid: DocumentUid): boolean {
      return activeBinding.value?.uid === uid
    }

    function activeRootGraphId(uid: DocumentUid): RootGraphId | null {
      return isActive(uid) ? (activeBinding.value?.rootGraphId ?? null) : null
    }

    function subscribe(listener: DocumentTransitionListener): () => void {
      if (listeners.has(listener)) {
        reportError('Document lifecycle listener is already registered', {
          errorType: 'document_lifecycle_duplicate_listener',
          surface: 'graph'
        })
        return () => {}
      }
      listeners.add(listener)
      return () => listeners.delete(listener)
    }

    function $reset(): void {
      activeBinding.value = null
      listeners.clear()
    }

    return {
      activeBinding,
      beginTransition,
      activate,
      isActive,
      activeRootGraphId,
      subscribe,
      $reset
    }
  }
)
