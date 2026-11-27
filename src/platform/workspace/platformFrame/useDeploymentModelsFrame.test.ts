import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { usePlatformFrameStore } from './platformFrameStore'
import { useDeploymentModelsFrame } from './useDeploymentModelsFrame'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('firebase/auth'))

const DEPLOYMENT = 'dep-a2a2a2a2-0000-4000-8000-000000000002'

function bootOn(deploymentId: string | null) {
  Object.assign(useDeploymentPickStore(), {
    bootDeployment:
      deploymentId === null
        ? null
        : {
            deployment_id: deploymentId,
            release_id: 'r-2',
            status: 'ready',
            can_start: false,
            created_at: '2026-10-01T00:00:00Z'
          }
  })
}

beforeEach(() => {
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: true
  })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
})

afterEach(() => {
  usePlatformFrameStore().close()
})

describe('useDeploymentModelsFrame', () => {
  it('names the deployment this page runs on', () => {
    bootOn(DEPLOYMENT)
    const { bootDeploymentId } = useDeploymentModelsFrame()

    expect(bootDeploymentId.value).toBe(DEPLOYMENT)
  })

  it.for([
    { label: 'on Comfy Cloud', boot: null, flag: true },
    { label: 'before the listing answers', boot: undefined, flag: true },
    { label: 'with the flag off', boot: DEPLOYMENT, flag: false }
  ])('offers nothing $label', ({ boot, flag }) => {
    if (boot !== undefined) bootOn(boot)
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: flag
    })
    const { bootDeploymentId } = useDeploymentModelsFrame()

    expect(bootDeploymentId.value).toBeUndefined()
  })
})
