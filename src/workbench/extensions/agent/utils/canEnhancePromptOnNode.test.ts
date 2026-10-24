import { describe, expect, it } from 'vitest'

import {
  canEnhancePromptOnNode,
  isClipTextEncodeNode
} from './canEnhancePromptOnNode'

describe('canEnhancePromptOnNode', () => {
  it.for([
    { nodeType: 'CLIPTextEncode', isApiNode: false, expected: true },
    { nodeType: 'CLIPTextEncodeSDXL', isApiNode: false, expected: true },
    { nodeType: 'CLIPTextEncodeFlux', isApiNode: false, expected: true },
    { nodeType: 'ByteDanceSeedance', isApiNode: true, expected: true },
    { nodeType: 'KSampler', isApiNode: false, expected: false },
    { nodeType: 'PrimitiveStringMultiline', isApiNode: false, expected: false },
    { nodeType: undefined, isApiNode: true, expected: false }
  ])(
    'allows $nodeType when api_node=$isApiNode → $expected',
    ({ nodeType, isApiNode, expected }) => {
      expect(canEnhancePromptOnNode({ nodeType, isApiNode })).toBe(expected)
    }
  )

  it('treats CLIP text encode variants as clip nodes', () => {
    expect(isClipTextEncodeNode('CLIPTextEncode')).toBe(true)
    expect(isClipTextEncodeNode('CLIPTextEncodeControlnet')).toBe(true)
    expect(isClipTextEncodeNode('KSampler')).toBe(false)
  })
})
