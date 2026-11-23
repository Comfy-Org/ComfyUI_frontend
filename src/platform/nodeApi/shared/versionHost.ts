import type { LGraph } from '@/lib/litegraph/src/LGraph'

import type { RestoredState } from './documentHandles'

/** A V4 pack the backend verified, served at `/extensions/<segment>/`. */
export interface ServedPack {
  readonly segment: string
  readonly id: string
  readonly version: string | null
}

/** What one published API version gives the host: every call the host makes into a version. */
export interface VersionHost {
  /** Puts the version's window slot in place, before extensions load. */
  publish(): void
  /** Tells packs the app is set up. */
  markReady(): void
  /** The packs the backend verified, before any pack loads; `undefined` if the backend gave none. */
  providePacks(served: readonly ServedPack[] | undefined): void
  /**
   * Retires every handle when the host freezes `graph`'s document to load another, and, until that load finishes,
   * each one taken in it. Not for undo or redo, which rebuild it.
   */
  endDocument(graph: LGraph): void
  /**
   * Retires every handle, just before the graph is configured from a saved document. Not for undo or redo, which
   * rebuild the document that is open.
   */
  beginDocument(): void
  /** Just before an undo or redo configures `state`: a handle to a node `state` lacks reads only that node until the restore ends. */
  beforeHistoryRestore(state: RestoredState): void
  /** Retires each handle whose entity an undo or redo removed. */
  afterHistoryRestore(): void
  /** Puts back the colors packs gave their types, after a palette cleared them. */
  reapplyTypeColors(): void
}
