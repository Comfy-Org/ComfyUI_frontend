import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { applyTextReplacements } from '@/utils/searchAndReplace'

import { ComfyApiError } from './errors'

/** Parsed ComfyUI workflow JSON. */
export type WorkflowData = Readonly<Record<string, unknown>>

export interface WorkflowHandle {
  /** Replaces the active document with parsed ComfyUI workflow JSON. */
  open(data: WorkflowData): Promise<void>
  /** Expands the active document's `%date:...%` and `%Node.widget%` tokens. */
  applyTextReplacements(value: string): string
}

export function createWorkflowApi(
  getGraph: () => LGraph | null | undefined,
  openWorkflow?: (data: WorkflowData) => Promise<void>
): WorkflowHandle {
  return Object.freeze({
    async open(data: WorkflowData) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
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
    }
  })
}
