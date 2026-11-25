import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

/** A workflow's own graph after an undo/redo restore, with its serialized state before and after. */
export interface GraphRestore {
  workflow: ComfyWorkflow
  graph: LGraph
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
        errorType: 'error_notifying_graph_restore_listener'
      })
    }
  }
}
