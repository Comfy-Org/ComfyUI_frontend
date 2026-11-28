import { useTelemetry } from '@comfyorg/telemetry'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { FollowedBuild } from '@/platform/workspace/platformFrame/platformFrameBuild'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  trackDeploymentCreateClicked,
  trackDeploymentDialogOpened,
  trackDeploymentLinkClicked,
  trackDeploymentLinkOpened
} from './customDeploymentTelemetry'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/composables/useFeatureFlags'))

const BUILD: FollowedBuild = {
  kind: 'new',
  buildId: 'b-1',
  accountId: 'uid-ana',
  workspaceId: 'ws-1',
  deploymentId: 'dep-1',
  deploymentName: 'portrait-upscale',
  releaseId: 'r-1',
  version: 1,
  previousReleaseId: null,
  previousVersion: null,
  stage: 'building',
  progress: null,
  startedAt: 0
}

function sent() {
  return vi
    .mocked(useTelemetry()!.trackCustomDeploymentEvent)
    .mock.calls.map(([event]) => event)
}

function flagOn(on: boolean) {
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: on
  })
}

beforeEach(() => {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
  flagOn(true)
})

describe('custom deployment funnel events', () => {
  it('sends Dialog opened with the way in and the step, and no workflow', () => {
    trackDeploymentDialogOpened(
      'set_up',
      { step: 'new', handsOverWorkflow: true },
      'ws-1'
    )

    expect(sent()).toEqual([
      {
        name: 'platform:editor_deploy_opened',
        properties: {
          entry: 'set_up',
          step: 'new',
          workspace_id: 'ws-1',
          deployment_id: null
        }
      }
    ])
  })

  it('sends no Dialog opened for a frame that only follows a build', () => {
    trackDeploymentDialogOpened(
      'extensions',
      { step: 'follow', releaseId: 'r-1', version: 1 },
      'ws-1'
    )

    expect(sent()).toEqual([])
  })

  it('sends Create clicked with the ids the server events carry', () => {
    trackDeploymentCreateClicked(BUILD)

    expect(sent()).toEqual([
      {
        name: 'platform:deployment_create_clicked',
        properties: {
          kind: 'new',
          workspace_id: 'ws-1',
          deployment_id: 'dep-1',
          release_id: 'r-1',
          build_id: 'b-1',
          version: 1
        }
      }
    ])
  })

  it.for(['build_on_platform', 'manage_deployments'] as const)(
    'sends a %s click with the workspace',
    (kind) => {
      trackDeploymentLinkClicked(kind)

      expect(sent()).toEqual([
        {
          name: 'platform:deployment_link_clicked',
          properties: { kind, workspace_id: 'ws-1' }
        }
      ])
    }
  )

  it('sends a link click once its default action went ahead', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const click = new MouseEvent('click', { cancelable: true })

    trackDeploymentLinkOpened(click, 'manage_deployments')
    expect(sent()).toEqual([])
    await vi.runAllTimersAsync()

    expect(sent()).toEqual([
      {
        name: 'platform:deployment_link_clicked',
        properties: { kind: 'manage_deployments', workspace_id: 'ws-1' }
      }
    ])
  })

  it('sends nothing for a link click whose default action was cancelled', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const click = new MouseEvent('click', { cancelable: true })

    trackDeploymentLinkOpened(click, 'manage_deployments')
    click.preventDefault()
    await vi.runAllTimersAsync()

    expect(sent()).toEqual([])
  })

  it('sends nothing with the flag off', () => {
    flagOn(false)

    trackDeploymentDialogOpened('pencil', { step: 'update' }, 'ws-1')
    trackDeploymentCreateClicked(BUILD)
    trackDeploymentLinkClicked('manage_deployments')

    expect(sent()).toEqual([])
  })
})
