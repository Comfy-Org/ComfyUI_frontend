import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { usePlatformFrameStore } from './platformFrameStore'
import {
  deploymentModelsRequest,
  useDeploymentModelsFrame
} from './useDeploymentModelsFrame'

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

function framedAt(): Record<string, string> | null {
  const url = usePlatformFrameStore().session?.url
  if (!url) return null
  const { step, deployment } = Object.fromEntries(new URL(url).searchParams)
  return { step, deployment }
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
  it('opens Models alone for the deployment this page runs on', () => {
    bootOn(DEPLOYMENT)
    const { bootDeploymentId, addModels } = useDeploymentModelsFrame()

    expect(bootDeploymentId.value).toBe(DEPLOYMENT)
    expect(addModels()).toBe(true)

    expect(framedAt()).toEqual({ step: 'models', deployment: DEPLOYMENT })
    expect(usePlatformFrameStore().session?.request.handsOverWorkflow).toBe(
      undefined
    )
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
    const { bootDeploymentId, addModels } = useDeploymentModelsFrame()

    expect(bootDeploymentId.value).toBeUndefined()
    expect(addModels()).toBe(false)
    expect(framedAt()).toBeNull()
  })
})

describe('deploymentModelsRequest', () => {
  it('hands the open workflow over only when asked', () => {
    expect(deploymentModelsRequest(DEPLOYMENT)).toEqual({
      step: 'models',
      deploymentId: DEPLOYMENT
    })
    const handedOver = deploymentModelsRequest(DEPLOYMENT, {
      handsOverWorkflow: true
    })
    expect(handedOver).toEqual({
      step: 'models',
      deploymentId: DEPLOYMENT,
      handsOverWorkflow: true
    })
  })
})
