import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { app } from '@/scripts/app'
import { useAuthStore } from '@/stores/authStore'
import type { ModelFolder } from '@/stores/modelStore'
import { useModelStore } from '@/stores/modelStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('@/scripts/app'))
vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@comfyorg/telemetry/reportError'))

function node(
  comfyClass: string,
  inputs: Record<string, string> = {},
  mode: LGraphEventMode = LGraphEventMode.ALWAYS
): LGraphNode {
  const graphNode = new LGraphNode(comfyClass)
  graphNode.comfyClass = comfyClass
  graphNode.mode = mode
  for (const [name, value] of Object.entries(inputs))
    graphNode.addWidget('text', name, value, () => {})
  return graphNode
}

function workflowHas(...nodes: LGraphNode[]) {
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(fromPartial({ nodes }))
}

function requestBody() {
  const [, init] = vi.mocked(fetch).mock.calls[0]
  return JSON.parse(String(init?.body))
}

function cloudAnswers(response: Response | Error) {
  if (response instanceof Error) vi.mocked(fetch).mockRejectedValue(response)
  else vi.mocked(fetch).mockResolvedValue(response)
}

describe(checkCloudCompatibility, () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    workflowHas(node('KSampler'))
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
    workflowHas(
      node('CheckpointLoaderSimple', { ckpt_name: 'sdxl.safetensors' }),
      node('KSampler')
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

  it('sends models from loaders the asset picker does not map, using the local model folders', async () => {
    vi.spyOn(useModelStore(), 'loadModels').mockResolvedValue([
      fromPartial<ModelFolder>({
        directory: 'text_encoders',
        models: {
          '0/t5xxl_fp16.safetensors': { file_name: 't5xxl_fp16.safetensors' },
          '0/clip_l.safetensors': { file_name: 'clip_l.safetensors' }
        }
      })
    ])
    workflowHas(
      node('DualCLIPLoader', {
        clip_name1: 't5xxl_fp16.safetensors',
        clip_name2: 'clip_l.safetensors',
        type: 'flux'
      })
    )
    cloudAnswers(
      Response.json({
        cloud: {
          missing_node_types: [],
          missing_models: [
            { folder: 'text_encoders', name: 't5xxl_fp16.safetensors' }
          ]
        }
      })
    )

    await expect(checkCloudCompatibility()).resolves.toEqual({
      kind: 'missing',
      gaps: {
        nodePacks: [],
        models: [{ folder: 'text_encoders', name: 't5xxl_fp16.safetensors' }]
      }
    })
    expect(requestBody().models).toEqual([
      { folder: 'text_encoders', name: 't5xxl_fp16.safetensors' },
      { folder: 'text_encoders', name: 'clip_l.safetensors' }
    ])
  })

  it('returns no verdict, without asking Cloud, when a loader model is not in the local library', async () => {
    vi.spyOn(useModelStore(), 'loadModels').mockResolvedValue([
      fromPartial<ModelFolder>({ directory: 'text_encoders', models: {} })
    ])
    workflowHas(
      node('DualCLIPLoader', { clip_name1: 't5xxl_fp16.safetensors' })
    )

    await expect(checkCloudCompatibility()).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reads widget values without running their serialize hooks', async () => {
    const audio = node('LoadAudio', { audio: 'take.wav' })
    const serializeValue = vi.fn()
    audio.widgets![0].serializeValue = serializeValue
    workflowHas(audio)
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    expect(serializeValue).not.toHaveBeenCalled()
    expect(requestBody().node_types).toEqual(['LoadAudio'])
  })

  it('asks about nodes inside subgraphs and skips bypassed, muted and virtual nodes', async () => {
    const subgraph = createTestSubgraph()
    subgraph.add(node('KSampler'))
    const reroute = node('Reroute')
    reroute.isVirtualNode = true
    workflowHas(
      node('ImpactWildcard', {}, LGraphEventMode.BYPASS),
      node('ImpactSwitch', {}, LGraphEventMode.NEVER),
      reroute,
      createTestSubgraphNode(subgraph)
    )
    cloudAnswers(Response.json({ cloud: { missing_node_types: [] } }))

    await checkCloudCompatibility()

    expect(requestBody().node_types).toEqual(['KSampler'])
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
