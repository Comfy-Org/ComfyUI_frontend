import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'
import { applyTextReplacements } from '@/utils/searchAndReplace'

import { ComfyApiError } from './errors'

/** Parsed ComfyUI workflow JSON. */
export type WorkflowData = Readonly<Record<string, unknown>>

export interface WorkflowHandle {
  /** Replaces the active document with parsed ComfyUI workflow JSON. */
  open(data: WorkflowData): Promise<void>
  /** Expands the active document's `%date:...%` and `%Node.widget%` tokens. */
  applyTextReplacements(value: string): string
  /**
   * The active document's identity: a process-local id minted fresh each time
   * a workflow finishes loading — including a second load of the same file,
   * which gets a different id from the first. `undefined` before the first
   * workflow has loaded this page load.
   *
   * Distinct from the workflow's own saved identity (its file path, or the
   * `id` written into the workflow JSON): that one is meant to survive a
   * reload and compare equal across sessions. This one is the opposite by
   * design — it exists so a pack can tell "the document I was looking at got
   * replaced" from "the document I was looking at got edited", which
   * comparing graph contents cannot do, since editing IS mutating the graph
   * contents of the very document that is still current.
   */
  documentId(): string | undefined
}

export function createWorkflowApi(
  getGraph: () => LGraph | null | undefined,
  openWorkflow?: (data: WorkflowData) => Promise<void>,
  getDocumentId?: () => string | undefined
): WorkflowHandle {
  return Object.freeze({
    async open(data: WorkflowData) {
      if (
        extensionValue(data) == null ||
        typeof data !== 'object' ||
        Array.isArray(data)
      ) {
        throw new ComfyApiError('Workflow data must be an object.')
      }
      if (!openWorkflow) {
        throw new ComfyApiError(
          'Workflow loading is not connected to the host.'
        )
      }
      await openWorkflow(data)
    },
    applyTextReplacements(value: string) {
      const graph = getGraph()?.rootGraph
      if (!graph) {
        throw new ComfyApiError(
          'Cannot apply workflow text replacements: no graph is active.'
        )
      }
      return applyTextReplacements(graph, value)
    },
    documentId() {
      return getDocumentId?.()
    }
  })
}
