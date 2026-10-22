import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { app } from '@/scripts/app'

/** The root graph as workflow JSON, or null when a node's serializer throws. */
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
