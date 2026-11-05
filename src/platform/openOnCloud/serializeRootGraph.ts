import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { app } from '@/scripts/app'

export function serializeRootGraph(): ComfyWorkflowJSON | null {
  try {
    return app.rootGraph.serialize() as unknown as ComfyWorkflowJSON
  } catch (error) {
    reportError(error, {
      errorType: 'open_on_cloud_serialize_failure',
      surface: 'graph'
    })
    return null
  }
}
