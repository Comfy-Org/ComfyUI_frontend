import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('@/scripts/app'))
vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@comfyorg/telemetry/reportError'))

function cloudAnswers(response: Response | Error) {
  if (response instanceof Error) vi.mocked(fetch).mockRejectedValue(response)
  else vi.mocked(fetch).mockResolvedValue(response)
}

describe(checkCloudCompatibility, () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    vi.mocked(app.graphToPrompt).mockResolvedValue(
      fromPartial({
        output: { 1: { class_type: 'KSampler', inputs: {} } }
      })
    )
    vi.spyOn(useAuthStore(), 'getAuthHeader').mockResolvedValue(null)
  })

  it('opens a workflow when Cloud omits the optional missing models', async () => {
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'canOpen'
    })
  })

  it('lists the node packs Cloud is missing', async () => {
    cloudAnswers(
      Response.json({ cloud: { missing_node_types: ['ImpactWildcard'] } })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'missing',
      gaps: { nodePacks: ['ImpactWildcard'], models: [] }
    })
  })

  it('asks Cloud about the node types and loader models the workflow uses', async () => {
    useNodeDefStore().updateNodeDefs([
      {
        name: 'CheckpointLoaderSimple',
        display_name: 'Load Checkpoint',
        category: 'loaders',
        python_module: 'nodes',
        description: '',
        output: ['MODEL'],
        output_node: false,
        deprecated: false,
        experimental: false,
        input: { required: { ckpt_name: ['COMBO', { options: [] }] } }
      }
    ])
    vi.mocked(app.graphToPrompt).mockResolvedValue(
      fromPartial({
        output: {
          1: {
            class_type: 'CheckpointLoaderSimple',
            inputs: { ckpt_name: 'sdxl.safetensors' }
          },
          2: { class_type: 'KSampler', inputs: { model: ['1', 0] } }
        }
      })
    )
    vi.mocked(useAuthStore().getAuthHeader).mockResolvedValue({
      Authorization: 'Bearer token'
    })
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' })
    expect(JSON.parse(String(init?.body))).toEqual({
      node_types: ['CheckpointLoaderSimple', 'KSampler'],
      models: [{ folder: 'checkpoints', name: 'sdxl.safetensors' }]
    })
  })

  it.for([
    { name: 'a network failure', response: () => new TypeError('offline') },
    {
      name: 'a failed response',
      response: () => new Response(null, { status: 503 })
    },
    {
      name: 'a body outside the contract',
      response: () => Response.json({ cloud: { missing_node_types: 'none' } })
    }
  ])('reports $name and returns no verdict', async ({ response }) => {
    cloudAnswers(response())

    await expect(checkCloudCompatibility()).resolves.toBeNull()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'failure_checking_cloud_compatibility'
      })
    )
  })
})
