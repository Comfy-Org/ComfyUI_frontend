import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { app } from '@/scripts/app'

export function serializeRootGraph(): ComfyWorkflowJSON | null {
  try {
    return app.rootGraph.serialize() as unknown as ComfyWorkflowJSON
  } catch (error) {
    reportError(error, {
      errorType: 'failure_serializing_open_on_cloud_graph',
      surface: 'graph'
    })
    return null
  }
}
