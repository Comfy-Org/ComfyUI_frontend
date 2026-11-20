import { useTelemetry } from '@comfyorg/telemetry'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useApp } from '@/scripts/appInstance'

export function setWorkflowDefaultView(
  workflow: LoadedComfyWorkflow,
  openAsApp: boolean
) {
  workflow.initialMode = openAsApp ? 'app' : 'graph'
  const extra = useApp().rootGraphOrUndefined?.extra
  if (!extra) return
  extra.linearMode = openAsApp
  workflow.changeTracker.captureCanvasState()
  useTelemetry()?.trackDefaultViewSet({
    default_view: openAsApp ? 'app' : 'graph'
  })
}
