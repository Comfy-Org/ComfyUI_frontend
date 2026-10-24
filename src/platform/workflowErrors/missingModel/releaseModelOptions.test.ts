import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import {
  cloudReleaseModelOptions,
  releaseModelOptions
} from '@/platform/workflowErrors/missingModel/releaseModelOptions'
import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_LISTING_TIMEOUT_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import type { WorkspaceDeploymentList } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { setDeploymentHint } from '@/platform/workspace/deploymentHint'
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

  it('does not wait on a listing still in flight once the boot settled on Comfy Cloud', async () => {
    loadCatalog()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    vi.spyOn(workspaceApi, 'listDeployments').mockReturnValue(
      new Promise(() => {})
    )
    const store = useDeploymentPickStore()
    void store.loadOnce()
    store.bootOnComfyCloud()
    let options: readonly (string | number)[] | undefined | 'pending' =
      'pending'
    void releaseModelOptions('LoraLoader', 'lora_name').then((result) => {
      options = result
    })

    await vi.advanceTimersByTimeAsync(0)

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
  beforeEach(() => {
    localStorage.clear()
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
  })

  afterEach(() => {
    distribution.isCloud = false
  })

  it.for<{
    runsOn: string
    isCloud: boolean
    hint: string | null | undefined
    url: string
    gives: typeof releaseModelOptions | undefined
  }>([
    {
      runsOn: 'Comfy Cloud, last booted on a deployment',
      isCloud: true,
      hint: 'dep-2',
      url: '/',
      gives: releaseModelOptions
    },
    {
      runsOn: 'Comfy Cloud with no hint',
      isCloud: true,
      hint: undefined,
      url: '/',
      gives: releaseModelOptions
    },
    {
      runsOn: 'Comfy Cloud from a deployment link, last booted on Comfy Cloud',
      isCloud: true,
      hint: null,
      url: '/?deployment=dep-2',
      gives: releaseModelOptions
    },
    {
      runsOn: 'Comfy Cloud, last booted on Comfy Cloud, with no link',
      isCloud: true,
      hint: null,
      url: '/',
      gives: undefined
    },
    {
      runsOn: 'Local',
      isCloud: false,
      hint: 'dep-2',
      url: '/',
      gives: undefined
    }
  ])(
    'waits on the listing only where the page may be on a deployment: $runsOn',
    ({ isCloud, hint, url, gives }) => {
      distribution.isCloud = isCloud
      if (hint !== undefined) setDeploymentHint('ws-1', hint)
      window.history.replaceState(null, '', url)
      onTestFinished(() => window.history.replaceState(null, '', '/'))

      expect(cloudReleaseModelOptions()).toBe(gives)
    }
  )
})
