import { describe, expect, it } from 'vitest'

import {
  missingPacksOf,
  nodesNeedingDeployment
} from '@/platform/workspace/missingForDeployment'

describe(nodesNeedingDeployment, () => {
  it('keeps the node types that have no replacement', () => {
    expect(
      nodesNeedingDeployment([
        'GroupNodeType',
        { type: 'BiRefNet', isReplaceable: false },
        { type: 'OldSampler', isReplaceable: true }
      ])
    ).toEqual(['GroupNodeType', { type: 'BiRefNet', isReplaceable: false }])
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
        'GroupNodeType'
      ])
    ).toEqual([
      { packId: 'comfyui-birefnet', nodeTypes: ['BiRefNet'] },
      { packId: 'comfyui-rmbg', nodeTypes: ['RMBG'] },
      { packId: null, nodeTypes: ['QwenImage21Cache', 'GroupNodeType'] }
    ])
  })
})
