import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { FrontendExecution } from '@/utils/executionUtil'

import type { CanvasSource } from './canvasSource'
import type { RestoredState } from './documentHandles'

/** A V4 pack the backend verified, served at `/extensions/<segment>/`. */
export interface ServedPack {
  readonly segment: string
  readonly id: string
  readonly version: string | null
}

/** What the host's `queuePrompt` tells a version's queue. */
export interface QueueHost {
  /** The backend accepted a prompt of the run call `requestId`. */
  promptSubmitted(requestId: number, promptId: string, nodeCount: number): void
  /** The backend refused a prompt. */
  promptRejected(): void
  /** The host finished every run call it was processing. */
  queueSettled(): void
}

/** A workflow or prompt a pack's importer read from a file. */
export type ImportedWorkflow =
  | { readonly workflow: object | string }
  | { readonly prompt: object | string }

export interface VersionNotices {
  /** Gives the version the canvas, before it is published. */
  provideCanvas(source: CanvasSource): void
  /** Puts the version's window slot in place at the start of each startup of the canvas, before extensions load. */
  publish(): void
  markReady(): void
  /** The packs the backend verified, before any pack loads; `undefined` if the backend gave none. */
  providePacks(served: readonly ServedPack[] | undefined): void
  /** When the host freezes `graph`'s document to load another; not for an undo or redo. */
  endDocument(graph: LGraph): void
  /** When a load or an import stops, finished, failed or replaced, before packs are told it loaded. */
  loadEnded(): void
  /** Just before the host configures a graph from a saved document, or builds one to import, or shows an open tab's live graph; not for an undo or redo. */
  beginDocument(): void
  /** Just before an undo or redo configures `state` into `graph`. */
  beforeHistoryRestore(graph: LGraph, state: RestoredState): void
  /** When the configure of an undo or redo ends, even if it failed or was cancelled. */
  afterHistoryRestore(): void
  /** Tells packs a workflow finished loading, or an undo or redo restored one. */
  workflowLoaded(): void
  /** Puts back the colors packs gave their types, after a palette cleared them. */
  reapplyTypeColors(): void
  /** Gives a preview the server sent for the node with `executionId` to packs. */
  deliverPreview(rootGraph: LGraph, executionId: string, blob: Blob): void
}

export interface VersionHost extends VersionNotices {
  /** What `queuePrompt` tells the queue. */
  readonly queue: QueueHost
  /** `found` if it holds a workflow; otherwise what a pack's importer reads from `file`. */
  importWorkflowFile<TFound extends object | undefined>(
    file: File,
    found: TFound
  ): Promise<TFound | ImportedWorkflow>
  /** What the prompt builder asks of the version. */
  readonly frontendExecution: FrontendExecution
}
