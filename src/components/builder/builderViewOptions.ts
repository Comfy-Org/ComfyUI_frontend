import { useTelemetry } from '@/platform/telemetry'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { app } from '@/scripts/app'

export function setWorkflowDefaultView(
  workflow: LoadedComfyWorkflow,
  openAsApp: boolean
) {
  workflow.initialMode = openAsApp ? 'app' : 'graph'
  const extra = (app.rootGraph.extra ??= {})
  extra.linearMode = openAsApp
  workflow.changeTracker?.captureCanvasState()
  useTelemetry()?.trackDefaultViewSet({
    default_view: openAsApp ? 'app' : 'graph'
  })
}
