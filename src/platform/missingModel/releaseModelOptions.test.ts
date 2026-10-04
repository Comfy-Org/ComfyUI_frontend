import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { releaseModelOptions } from '@/platform/missingModel/releaseModelOptions'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const deployment = {
  deployment_id: 'dep-2',
  release_id: 'r-2',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
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
})
