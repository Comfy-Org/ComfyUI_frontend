import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSettingStore } from '@/platform/settings/settingStore'
import { updatePendingWarnings } from '@/platform/workflow/core/utils/pendingWarnings'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { usePlatformFrameStore } from './platformFrameStore'
import { preinstallRequest, usePreinstallOffer } from './usePreinstallOffer'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/workspace/platformWorkflowHandoff'), () => ({
  captureOpenWorkflow: vi.fn(() => ({
    filename: 'portrait.json',
    workflow: { nodes: [] }
  }))
}))

const DEPLOYMENT = 'dep-a2a2a2a2-0000-4000-8000-000000000002'

const missingCheckpoint: MissingModelCandidate = {
  name: 'portrait-upscale.safetensors',
  nodeId: '1',
  nodeType: 'CheckpointLoaderSimple',
  widgetName: 'ckpt_name',
  isAssetSupported: false,
  isMissing: true
}

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

function openWorkflow(path: string) {
  useWorkflowStore().activeWorkflow = fromPartial({ path })
}

function framedAt(): Record<string, string> | null {
  const url = usePlatformFrameStore().session?.url
  if (!url) return null
  const { step, deployment } = Object.fromEntries(new URL(url).searchParams)
  return { step, deployment }
}

let scope = effectScope()

function startOffer() {
  scope = effectScope()
  scope.run(() => usePreinstallOffer())
}

beforeEach(() => {
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: true
  })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
  bootOn(DEPLOYMENT)
  openWorkflow('workflows/portrait.json')
})

afterEach(() => {
  scope.stop()
  usePlatformFrameStore().close()
  useMissingModelStore().setMissingModels([])
  useMissingNodesErrorStore().setMissingNodeTypes([])
})

describe('preinstallRequest', () => {
  it('asks for the pre-install screen and hands over the workflow', () => {
    expect(preinstallRequest(DEPLOYMENT)).toEqual({
      step: 'preinstall',
      deploymentId: DEPLOYMENT,
      handsOverWorkflow: true
    })
  })
})

describe('usePreinstallOffer', () => {
  it('opens the pre-install screen when the workflow lacks models', async () => {
    startOffer()
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()

    expect(framedAt()).toEqual({ step: 'preinstall', deployment: DEPLOYMENT })
    expect(usePlatformFrameStore().session?.workflow).toEqual({
      filename: 'portrait.json',
      workflow: { nodes: [] }
    })
  })

  it('opens once per workflow', async () => {
    startOffer()
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()
    usePlatformFrameStore().dismiss()
    await nextTick()

    useMissingModelStore().setMissingModels([])
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()
    expect(usePlatformFrameStore().session).toBeNull()

    openWorkflow('workflows/landscape.json')
    await nextTick()
    expect(framedAt()).toEqual({ step: 'preinstall', deployment: DEPLOYMENT })
  })

  it('stays closed when nothing is missing', async () => {
    startOffer()
    await nextTick()

    expect(usePlatformFrameStore().session).toBeNull()
  })

  it('stays closed when nodes are missing too', async () => {
    startOffer()
    useMissingNodesErrorStore().setMissingNodeTypes(['RgthreePowerLoraLoader'])
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()

    expect(usePlatformFrameStore().session).toBeNull()
  })

  it('stays closed when a saved workflow shows its models before its missing nodes', async () => {
    startOffer()
    updatePendingWarnings(useWorkflowStore().activeWorkflow, {
      missingNodeTypes: ['RgthreePowerLoraLoader'],
      missingModelCandidates: [missingCheckpoint]
    })
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()
    expect(usePlatformFrameStore().session).toBeNull()

    useMissingNodesErrorStore().setMissingNodeTypes(['RgthreePowerLoraLoader'])
    await nextTick()
    expect(usePlatformFrameStore().session).toBeNull()
  })

  it('stays closed when nodes are missing and their warning is off', async () => {
    useSettingStore().settingValues['Comfy.Workflow.ShowMissingNodesWarning'] =
      false
    startOffer()
    useMissingNodesErrorStore().setMissingNodeTypes(['RgthreePowerLoraLoader'])
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()

    expect(usePlatformFrameStore().session).toBeNull()
  })

  it('stays closed on Comfy Cloud, away from a deployment', async () => {
    bootOn(null)
    startOffer()
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()

    expect(usePlatformFrameStore().session).toBeNull()
  })

  it('stays closed with the flag off', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: false
    })
    startOffer()
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()

    expect(usePlatformFrameStore().session).toBeNull()
  })

  it('leaves an open Platform screen alone', async () => {
    usePlatformFrameStore().open(
      { step: 'models', deploymentId: DEPLOYMENT },
      'model_library'
    )
    startOffer()
    useMissingModelStore().setMissingModels([missingCheckpoint])
    await nextTick()

    expect(framedAt()).toEqual({ step: 'models', deployment: DEPLOYMENT })
  })
})
