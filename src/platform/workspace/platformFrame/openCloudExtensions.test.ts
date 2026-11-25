import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { openDeployCustomNodesDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { openCloudExtensions } from './openCloudExtensions'
import { usePlatformFrameStore } from './platformFrameStore'
import { NEW_DEPLOYMENT_FROM_NODES } from './platformFrameWaysIn'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('firebase/auth'))
vi.mock(
  import('@/platform/workspace/composables/waitForDeploymentPick'),
  () => ({
    waitForDeploymentListing: vi.fn(async () => {})
  })
)
vi.mock(import('@/platform/workspace/openCustomDeploymentDialog'), () => ({
  openDeployCustomNodesDialog: vi.fn(async () => true)
}))

type WorkspaceDeployment = ReturnType<
  typeof useDeploymentPickStore
>['deployments'][number]

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  release_id: 'rel-3',
  build_id: 'b-1',
  build_name: 'portrait-upscale',
  release_version: 3,
  status: 'ready',
  can_start: false,
  created_at: '2026-10-01T00:00:00Z'
}

function listing(items: WorkspaceDeployment[], picked: string | null = null) {
  useDeploymentPickStore().state = reduceDeploymentPick(
    { phase: 'idle' },
    loadedEvent({
      builds_visible: true,
      items,
      ...(picked
        ? { picked_deployment_id: picked, pick_source: 'browser' as const }
        : {})
    })
  )
}

function framedAt(): Record<string, string> | null {
  const url = usePlatformFrameStore().session?.url
  if (!url) return null
  return Object.fromEntries(
    [...new URL(url).searchParams].filter(([key]) =>
      ['step', 'start', 'deployment'].includes(key)
    )
  )
}

function flagOn(on: boolean) {
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: on
  })
}

beforeEach(() => {
  flagOn(true)
  vi.mocked(openDeployCustomNodesDialog).mockClear()
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
})

afterEach(() => {
  usePlatformFrameStore().close()
})

describe('openCloudExtensions', () => {
  it('opens Custom nodes for the deployment the editor runs on', async () => {
    listing([deployment], 'dep-1')

    expect(await openCloudExtensions()).toBe(true)

    expect(framedAt()).toEqual({ step: 'nodes', deployment: 'dep-1' })
    expect(openDeployCustomNodesDialog).not.toHaveBeenCalled()
  })

  it('opens a new deployment at its nodes on Comfy Cloud when the workspace has one already', async () => {
    listing([deployment])

    expect(await openCloudExtensions()).toBe(true)

    expect(framedAt()).toEqual({ step: 'new', start: 'nodes' })
    expect(openDeployCustomNodesDialog).not.toHaveBeenCalled()
  })

  it('shows the overview first when the workspace has no custom deployment', async () => {
    listing([])

    expect(await openCloudExtensions()).toBe(true)

    expect(framedAt()).toBeNull()
    expect(openDeployCustomNodesDialog).toHaveBeenCalledExactlyOnceWith(
      NEW_DEPLOYMENT_FROM_NODES
    )
  })

  it.for([
    { label: 'on a deployment', items: [deployment], picked: 'dep-1' },
    { label: 'on Comfy Cloud', items: [], picked: null }
  ])(
    "shows today's dialog $label with the flag off",
    async ({ items, picked }) => {
      flagOn(false)
      listing(items, picked)

      expect(await openCloudExtensions()).toBe(true)

      expect(framedAt()).toBeNull()
      expect(openDeployCustomNodesDialog).toHaveBeenCalledExactlyOnceWith()
    }
  )

  it('leaves Extensions to its survey when the workspace cannot see deployments', async () => {
    useDeploymentPickStore().state = { phase: 'hidden' }

    expect(await openCloudExtensions()).toBe(false)

    expect(framedAt()).toBeNull()
    expect(openDeployCustomNodesDialog).not.toHaveBeenCalled()
  })
})
