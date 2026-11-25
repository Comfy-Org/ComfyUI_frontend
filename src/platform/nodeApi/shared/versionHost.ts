import type { LGraph } from '@/lib/litegraph/src/LGraph'

import type { RestoredState } from './documentHandles'

/** A V4 pack the backend verified, served at `/extensions/<segment>/`. */
export interface ServedPack {
  readonly segment: string
  readonly id: string
  readonly version: string | null
}

export interface VersionHost {
  /** Puts the version's window slot in place at the start of each startup of the canvas, before extensions load. */
  publish(): void
  markReady(): void
  /** The packs the backend verified, before any pack loads; `undefined` if the backend gave none. */
  providePacks(served: readonly ServedPack[] | undefined): void
  /** When the host freezes `graph`'s document to load another or show another open tab; not for an undo or redo. */
  endDocument(graph: LGraph): void
  /** When a load, an import or a tab switch stops, finished, failed or replaced, before packs are told it loaded. */
  loadEnded(): void
  /** Just before the host configures a graph from a saved document, or builds one to import, or shows an open tab's live graph; not for an undo or redo. */
  beginDocument(): void
  /** Just before an undo or redo configures `state` into `graph`. */
  beforeHistoryRestore(graph: LGraph, state: RestoredState): void
  /** When the configure of an undo or redo ends, even if it failed or was cancelled. */
  afterHistoryRestore(): void
  /** Puts back the colors packs gave their types, after a palette cleared them. */
  reapplyTypeColors(): void
}
