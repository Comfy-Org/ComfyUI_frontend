import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { ComfyWidgets } from '@/scripts/widgets'
import { app } from '@/scripts/app'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/assets/composables/useAssetBrowserDialog'), () => ({
  registerAssetBrowserModalComponent: vi.fn(),
  useAssetBrowserDialog: () => ({ show: vi.fn(), browse: vi.fn() })
}))
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'localhost' as const,
  isDesktop: false,
  isNightly: false,
  isCloud: true
}))

const deployment = {
  deployment_id: 'dep-1',
  release_id: 'release-1',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
}

describe('model widgets on a deployment', () => {
  beforeEach(() => {
    useNodeDefStore().nodeDefsByName = {
      CheckpointLoaderSimple: fromPartial({ name: 'CheckpointLoaderSimple' })
    }
  })

  it.for([
    { nodeType: 'CheckpointLoaderSimple', input: 'ckpt_name' },
    { nodeType: 'LoraLoader', input: 'lora_name' },
    { nodeType: 'VAELoader', input: 'vae_name' },
    { nodeType: 'UNETLoader', input: 'unet_name' },
    { nodeType: 'DualCLIPLoader', input: 'clip_name1' },
    { nodeType: 'CustomModelLoader', input: 'custom_model' }
  ])(
    'constructs $nodeType with the catalog options and default',
    ({ nodeType, input }) => {
      useDeploymentPickStore().bootDeployment = deployment
      const node = new LGraphNode(nodeType)
      node.comfyClass = nodeType
      const { widget } = ComfyWidgets.COMBO(
        node,
        input,
        [['release.safetensors', 'other.safetensors'], {}],
        app
      )

      expect(widget.type).toBe('combo')
      expect(widget.options.values).toEqual([
        'release.safetensors',
        'other.safetensors'
      ])
      expect(widget.value).toBe('release.safetensors')
    }
  )

  it('keeps the Cloud asset picker when the page booted without a deployment', () => {
    useDeploymentPickStore().bootDeployment = null
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.comfyClass = 'CheckpointLoaderSimple'
    const { widget } = ComfyWidgets.COMBO(
      node,
      'ckpt_name',
      [['catalog.safetensors'], {}],
      app
    )

    expect(widget.type).toBe('asset')
  })
})
