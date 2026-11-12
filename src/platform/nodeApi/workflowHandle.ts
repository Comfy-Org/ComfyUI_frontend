import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'
import { applyTextReplacements } from '@/utils/searchAndReplace'

import type { DocumentHandle } from './documents'
import { ComfyApiError } from './errors'
import { registerWorkflowImporter } from './workflowImporters'
import type { WorkflowImporter } from './workflowImporters'
import type { Unsubscribe } from './widgetHandle'

/** Parsed ComfyUI workflow JSON. */
export type WorkflowData = Readonly<Record<string, unknown>>

export interface WorkflowHandle {
  /** Replaces the active document with parsed ComfyUI workflow JSON. */
  open(data: WorkflowData): Promise<void>
  /** Expands the active document's `%date:...%` and `%Node.widget%` tokens. */
  applyTextReplacements(value: string): string
  /** The document on screen, or `undefined` before one is open. */
  current(): DocumentHandle | undefined
  /** `current()?.id`: the identity of the open document's editing session. */
  documentId(): string | undefined
  /**
   * Adds a reader for files the host cannot load a workflow from. It is asked
   * when such a file is opened or dropped, before the host gives up on it.
   */
  registerImporter(importer: WorkflowImporter): Unsubscribe
}

export function createWorkflowApi(
  getGraph: () => LGraph | null | undefined,
  openWorkflow?: (data: WorkflowData) => Promise<void>,
  current: () => DocumentHandle | undefined = () => undefined
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
    current,
    documentId() {
      return current()?.id
    },
    registerImporter: registerWorkflowImporter
  })
}
