import type { CustomDeploymentEntry } from '@comfyorg/telemetry/types'

import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { asksForItsOwnTab } from '@/platform/workspace/platformWorkflowHandoff'

export const NEW_DEPLOYMENT_FROM_NODES: PlatformFrameRequest = {
  step: 'new',
  startAtNodes: true,
  handsOverWorkflow: true
}

export const NEW_DEPLOYMENT_FOR_WORKFLOW: PlatformFrameRequest = {
  step: 'new',
  handsOverWorkflow: true
}

export function openPlatformFrameOnClick(
  event: MouseEvent,
  request: PlatformFrameRequest,
  entry: CustomDeploymentEntry
): boolean {
  if (asksForItsOwnTab(event)) return false
  if (!usePlatformFrameStore().open(request, entry)) return false
  event.preventDefault()
  return true
}
