import { createUuidv4 } from '@/utils/uuid'

/**
 * Stable frontend-owned identity of a `GraphDocument` (ADR-0024). Every
 * document has one, including local and unsaved workflows. A cloud-backed
 * document may additionally map a canonical `workflow_id` — the wire address
 * used by agent commands — but that mapping lives in the document registry;
 * it is never the document's own identity.
 */
export type DocumentId = string & { readonly __brand: 'DocumentId' }

export function toDocumentId(value: string): DocumentId {
  return value as DocumentId
}

export function createDocumentId(): DocumentId {
  return createUuidv4() as DocumentId
}
