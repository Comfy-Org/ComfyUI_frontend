import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { reportError } from '@/platform/telemetry/reportError'

/** The active workflow's graph as serialized before and after an undo/redo restore. */
export interface GraphRestore {
  previous: ComfyWorkflowJSON
  next: ComfyWorkflowJSON
}

type GraphRestoreListener = (restore: GraphRestore) => void

const listeners = new Set<GraphRestoreListener>()

export function onGraphRestored(listener: GraphRestoreListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitGraphRestored(restore: GraphRestore): void {
  for (const listener of listeners) {
    try {
      listener(restore)
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'graph_restore_listener_failed'
      })
    }
  }
}
