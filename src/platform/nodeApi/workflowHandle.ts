import { ComfyApiError } from './errors'

/** Parsed ComfyUI workflow JSON. */
export type WorkflowData = Readonly<Record<string, unknown>>

export interface WorkflowHandle {
  /** Replaces the active document with parsed ComfyUI workflow JSON. */
  open(data: WorkflowData): Promise<void>
}

export function createWorkflowApi(
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
    }
  })
}
