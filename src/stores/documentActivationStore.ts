import { defineStore } from 'pinia'

import { createDocumentActivationHost } from '@/core/graph/document/documentActivationHost'
import { useGraphDocumentStore } from '@/stores/graphDocumentStore'

/**
 * App-wide singleton of the activation host, wired to the GraphDocument
 * registry. The workflow load path drives it; op-targeting consumers read it.
 */
export const useDocumentActivationStore = defineStore(
  'documentActivation',
  () => {
    const documents = useGraphDocumentStore()
    return createDocumentActivationHost({
      isLoaded: (documentId) =>
        documents.getDocument(documentId)?.state.phase === 'loaded',
      commitScope: (documentId, scope) => {
        if (!documents.hydrateDocument(documentId, scope))
          documents.rebindScope(documentId, scope)
      }
    })
  }
)
