import { describe, expect, it } from 'vitest'

import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import {
  missingModelsOf,
  missingPacksOf,
  nodesNeedingDeployment
} from '@/platform/workspace/missingForDeployment'

function candidate(name: string, directory: string): MissingModelCandidate {
  return {
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    isAssetSupported: false,
    name,
    directory,
    isMissing: true
  }
}

describe(nodesNeedingDeployment, () => {
  it('keeps only custom node types the editor found no replacement for', () => {
    expect(
      nodesNeedingDeployment([
        'LegacyNodeType',
        { type: 'workflow>My group', nodeId: '4', hint: 'missing: BiRefNet' },
        { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false },
        { type: 'OldSampler', isReplaceable: true },
        { type: 'NewerCoreNode', cnrId: 'comfy-core', isReplaceable: false }
      ])
    ).toEqual([
      { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false }
    ])
  })
})

describe(missingPacksOf, () => {
  it('groups node types by pack once each, with unknown packs last', () => {
    expect(
      missingPacksOf([
        { type: 'QwenImage21Cache' },
        { type: 'BiRefNet', cnrId: 'comfyui-birefnet' },
        { type: 'BiRefNet', cnrId: 'comfyui-birefnet' },
        { type: 'RMBG', cnrId: 'comfyui-rmbg' },
        { type: 'Unnamed', cnrId: '' }
      ])
    ).toEqual([
      { packId: 'comfyui-birefnet', nodeTypes: ['BiRefNet'] },
      { packId: 'comfyui-rmbg', nodeTypes: ['RMBG'] },
      { packId: null, nodeTypes: ['QwenImage21Cache', 'Unnamed'] }
    ])
  })
})

describe(missingModelsOf, () => {
  it('keeps a file once per models folder, and the same file in two folders twice', () => {
    expect(
      missingModelsOf([
        candidate('model.safetensors', 'controlnet'),
        candidate('model.safetensors', 'controlnet'),
        candidate('model.safetensors', 'vae')
      ])
    ).toEqual([
      { name: 'model.safetensors', directory: 'controlnet', url: undefined },
      { name: 'model.safetensors', directory: 'vae', url: undefined }
    ])
  })
})
