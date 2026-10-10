import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { releaseModelOptions } from '@/platform/missingModel/releaseModelOptions'
import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_LISTING_TIMEOUT_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const deployment = {
  deployment_id: 'dep-2',
  release_id: 'r-2',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
}

const bootListing: WorkspaceDeploymentList = {
  builds_visible: true,
  picked_deployment_id: deployment.deployment_id,
  pick_source: 'browser',
  items: [deployment]
}

function loadCatalog() {
  useNodeDefStore().nodeDefsByName = {
    LoraLoader: fromPartial<ComfyNodeDefImpl>({
      inputs: {
        lora_name: {
          type: 'COMBO',
          name: 'lora_name',
          options: ['homestead_private_v1.safetensors']
        },
        strength_model: { type: 'FLOAT', name: 'strength_model' }
      }
    })
  }
}

describe('releaseModelOptions', () => {
  it.for([
    {
      booted: 'a deployment',
      bootDeployment: deployment,
      input: 'lora_name',
      options: ['homestead_private_v1.safetensors']
    },
    {
      booted: 'a deployment',
      bootDeployment: deployment,
      input: 'strength_model',
      options: undefined
    },
    {
      booted: 'Comfy Cloud',
      bootDeployment: null,
      input: 'lora_name',
      options: undefined
    }
  ])(
    'gives the $input options of the catalog the page booted on $booted',
    async ({ bootDeployment, input, options }) => {
      loadCatalog()
      useDeploymentPickStore().$patch({ bootDeployment })

      await expect(releaseModelOptions('LoraLoader', input)).resolves.toEqual(
        options
      )
    }
  )

  it('checks the library as on Comfy Cloud once the backstop passes when the listing never answers', async () => {
    loadCatalog()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.spyOn(workspaceApi, 'listDeployments').mockReturnValue(
      new Promise(() => {})
    )
    let options: readonly (string | number)[] | undefined | 'pending' =
      'pending'
    void releaseModelOptions('LoraLoader', 'lora_name').then((result) => {
      options = result
    })

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS - 1)
    expect(options).toBe('pending')
    await vi.advanceTimersByTimeAsync(1)
    expect(options).toBeUndefined()
  })

  it('waits for a listing that answers just inside the request timeout', async () => {
    loadCatalog()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.spyOn(workspaceApi, 'listDeployments').mockReturnValue(
      new Promise((resolve) =>
        setTimeout(
          () => resolve(bootListing),
          DEPLOYMENT_LISTING_TIMEOUT_MS - 1
        )
      )
    )
    const options = releaseModelOptions('LoraLoader', 'lora_name')

    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_TIMEOUT_MS)

    await expect(options).resolves.toEqual(['homestead_private_v1.safetensors'])
  })
})
