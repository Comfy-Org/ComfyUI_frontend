import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cloudReleaseModelOptions,
  releaseModelOptions
} from '@/platform/missingModel/releaseModelOptions'
import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_LISTING_TIMEOUT_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get DISTRIBUTION() {
    return distribution.isCloud ? 'cloud' : 'localhost'
  },
  isDesktop: false,
  get isCloud() {
    return distribution.isCloud
  },
  isNightly: false
}))

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
  const nodeDefStore = useNodeDefStore()
  nodeDefStore.nodeDefsByName = {
    LoraLoader: fromPartial<(typeof nodeDefStore.nodeDefsByName)[string]>({
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
  it.for([
    {
      listing: 'fails',
      answer: () => Promise.reject(new Error('timeout of 30000ms exceeded'))
    },
    {
      listing: 'cannot be read',
      answer: () =>
        Promise.resolve(
          fromAny<WorkspaceDeploymentList, unknown>({ builds_visible: true })
        )
    }
  ])(
    'checks the library as on Comfy Cloud when the listing $listing',
    async ({ answer }) => {
      loadCatalog()
      Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
      vi.spyOn(workspaceApi, 'listDeployments').mockImplementation(answer)

      await expect(
        releaseModelOptions('LoraLoader', 'lora_name')
      ).resolves.toBeUndefined()
    }
  )

  it('gives up at once when the check is aborted before the listing answers', async () => {
    loadCatalog()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.spyOn(workspaceApi, 'listDeployments').mockReturnValue(
      new Promise(() => {})
    )
    const controller = new AbortController()

    const options = releaseModelOptions(
      'LoraLoader',
      'lora_name',
      controller.signal
    )
    controller.abort()

    await expect(options).resolves.toBeUndefined()
  })
})

describe('cloudReleaseModelOptions', () => {
  afterEach(() => {
    distribution.isCloud = false
  })

  it.for([
    { runsOn: 'Comfy Cloud', isCloud: true, gives: releaseModelOptions },
    { runsOn: 'Local', isCloud: false, gives: undefined }
  ])(
    'gives releaseModelOptions only on Comfy Cloud: on $runsOn',
    ({ isCloud, gives }) => {
      distribution.isCloud = isCloud

      expect(cloudReleaseModelOptions()).toBe(gives)
    }
  )
})
