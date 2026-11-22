import { useTelemetry } from '@comfyorg/telemetry'
import type {
  CustomDeploymentEntry,
  CustomDeploymentLink,
  CustomDeploymentTelemetryEvent
} from '@comfyorg/telemetry/types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { FollowedBuild } from '@/platform/workspace/platformFrame/platformFrameBuild'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

function send(event: CustomDeploymentTelemetryEvent) {
  if (!useFeatureFlags().flags.customDeploymentsEditorEnabled) return
  useTelemetry()?.trackCustomDeploymentEvent(event)
}

export function trackDeploymentDialogOpened(
  entry: CustomDeploymentEntry,
  request: PlatformFrameRequest,
  workspaceId: string | null
) {
  if (request.step === 'follow') return
  send({
    name: 'platform:editor_deploy_opened',
    properties: {
      entry,
      step: request.step,
      workspace_id: workspaceId,
      deployment_id: request.deploymentId ?? null
    }
  })
}

export function trackDeploymentCreateClicked(build: FollowedBuild) {
  send({
    name: 'platform:deployment_create_clicked',
    properties: {
      kind: build.kind,
      workspace_id: build.workspaceId,
      deployment_id: build.deploymentId,
      release_id: build.releaseId,
      build_id: build.buildId,
      version: build.version
    }
  })
}

export function trackDeploymentLinkClicked(kind: CustomDeploymentLink) {
  send({
    name: 'platform:deployment_link_clicked',
    properties: {
      kind,
      workspace_id: useTeamWorkspaceStore().activeWorkspaceId ?? null
    }
  })
}
