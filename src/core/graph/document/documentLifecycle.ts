/**
 * The pure lifecycle/persistence transition of one `GraphDocument`
 * (ADR-0024). Lifecycle (`created | loaded | closed`) and persistence
 * (`unsaved | clean | dirty`) are independent: the first describes document
 * existence, the second compares the document with its persistence baseline.
 * Persistence is derived from `revision` vs `savedRevision`, never stored.
 *
 * Save capture happens outside the reducer: a caller captures
 * `{ revision, bytes }` before starting I/O and reports `saveCompleted` with
 * that exact revision. The baseline advances to the captured revision only,
 * so mutations that commit while the save is in flight leave the document
 * dirty. Close is a compare-and-set over an exact revision: a decision made
 * against a revision that has since moved is stale and ignored.
 */

type DocumentLifecyclePhase = 'created' | 'loaded' | 'closed'
export type DocumentPersistenceState = 'unsaved' | 'clean' | 'dirty'

export interface DocumentTrackingState {
  readonly phase: DocumentLifecyclePhase
  /** Monotonic; incremented by every committed domain mutation. */
  readonly revision: number
  /** Persistence baseline revision; `null` until the first completed save. */
  readonly savedRevision: number | null
}

export type DocumentEvent =
  | { type: 'hydrated' }
  | { type: 'mutated' }
  | { type: 'saveCompleted'; atRevision: number }
  | { type: 'closed'; atRevision: number; discardChanges: boolean }

export const initialDocumentState: DocumentTrackingState = {
  phase: 'created',
  revision: 0,
  savedRevision: null
}

export function persistenceOf(
  state: DocumentTrackingState
): DocumentPersistenceState {
  if (state.savedRevision === null) return 'unsaved'
  return state.revision === state.savedRevision ? 'clean' : 'dirty'
}

export function reduceDocument(
  state: DocumentTrackingState,
  event: DocumentEvent
): DocumentTrackingState {
  switch (event.type) {
    case 'hydrated':
      return state.phase === 'created' ? { ...state, phase: 'loaded' } : state
    case 'mutated':
      return state.phase === 'closed'
        ? state
        : { ...state, revision: state.revision + 1 }
    case 'saveCompleted':
      if (state.phase === 'closed') return state
      if (event.atRevision > state.revision) return state
      if (
        state.savedRevision !== null &&
        event.atRevision < state.savedRevision
      )
        return state
      return { ...state, savedRevision: event.atRevision }
    case 'closed': {
      // `created` documents are closable too: a document whose hydration
      // failed (or never ran) must not be stuck in the registry forever.
      if (state.phase === 'closed') return state
      if (event.atRevision !== state.revision) return state
      if (!event.discardChanges && persistenceOf(state) !== 'clean')
        return state
      return { ...state, phase: 'closed' }
    }
  }
}
