import { describe, expect, it } from 'vitest'

import { useNodePricing } from '@/composables/node/useNodePricing'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'

// Helper function to create a mock node
function createMockNode(
  nodeTypeName: string,
  widgets: Array<{ name: string; value: any }> = [],
  isApiNode = true
): LGraphNode {
  const mockWidgets = widgets.map(({ name, value }) => ({
    name,
    value,
    type: 'combo'
  })) as IComboWidget[]

  return {
    id: Math.random().toString(),
    widgets: mockWidgets,
    constructor: {
      nodeData: {
        name: nodeTypeName,
        api_node: isApiNode
      }
    }
  } as unknown as LGraphNode
}

describe('useNodePricing', () => {
  describe('static pricing', () => {
    it('should return static price for FluxProCannyNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('FluxProCannyNode')

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.05/Run')
    })

    it('should return static price for StabilityStableImageUltraNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('StabilityStableImageUltraNode')

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.08/Run')
    })

    it('should return empty string for non-API nodes', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('RegularNode', [], false)

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })

    it('should return empty string for unknown node types', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('UnknownAPINode')

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })
  })

  describe('dynamic pricing - KlingTextToVideoNode', () => {
    it('should return high price for kling-v2-1-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'standard / 5s / v2-1-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$1.40/Run')
    })

    it('should return high price for kling-v2-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'standard / 5s / v2-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$1.40/Run')
    })

    it('should return standard price for kling-v1-6 model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'standard / 5s / v1-6' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.28/Run')
    })

    it('should return range when mode widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.14-2.80/Run (varies with model, mode & duration)')
    })
  })

  describe('dynamic pricing - KlingImage2VideoNode', () => {
    it('should return high price for kling-v2-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [
        { name: 'model_name', value: 'v2-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$1.40/Run')
    })

    it('should return high price for kling-v2-1-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [
        { name: 'model_name', value: 'v2-1-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$1.40/Run')
    })

    it('should return standard price for kling-v1-6 model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [
        { name: 'model_name', value: 'v1-6' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.28/Run')
    })

    it('should return range when model_name widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.14-2.80/Run (varies with model, mode & duration)')
    })
  })

  describe('dynamic pricing - OpenAIDalle3', () => {
    it('should return $0.04 for 1024x1024 standard quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1024' },
        { name: 'quality', value: 'standard' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.04/Run')
    })

    it('should return $0.08 for 1024x1024 hd quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1024' },
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.08/Run')
    })

    it('should return $0.08 for 1792x1024 standard quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1792x1024' },
        { name: 'quality', value: 'standard' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.08/Run')
    })

    it('should return $0.16 for 1792x1024 hd quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1792x1024' },
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.12/Run')
    })

    it('should return $0.08 for 1024x1792 standard quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1792' },
        { name: 'quality', value: 'standard' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.08/Run')
    })

    it('should return $0.16 for 1024x1792 hd quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1792' },
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.12/Run')
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.04-0.12/Run (varies with size & quality)')
    })

    it('should return range when size widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.04-0.12/Run (varies with size & quality)')
    })

    it('should return range when quality widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1024' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.04-0.12/Run (varies with size & quality)')
    })
  })

  describe('dynamic pricing - MinimaxHailuoVideoNode', () => {
    it('should return $0.28 for 6s duration and 768P resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [
        { name: 'duration', value: '6' },
        { name: 'resolution', value: '768P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.28/Run')
    })

    it('should return $0.60 for 10s duration and 768P resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [
        { name: 'duration', value: '10' },
        { name: 'resolution', value: '768P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.56/Run')
    })

    it('should return $0.49 for 6s duration and 1080P resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [
        { name: 'duration', value: '6' },
        { name: 'resolution', value: '1080P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.49/Run')
    })

    it('should return range when duration widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.28-0.56/Run (varies with resolution & duration)')
    })
  })

  describe('dynamic pricing - OpenAIDalle2', () => {
    it('should return $0.02 for 1024x1024 size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '1024x1024' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.020/Run')
    })

    it('should return $0.018 for 512x512 size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '512x512' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.018/Run')
    })

    it('should return $0.016 for 256x256 size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '256x256' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.016/Run')
    })

    it('should return range when size widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.016-0.02 x n/Run (varies with size & n)')
    })
  })

  describe('dynamic pricing - OpenAIGPTImage1', () => {
    it('should return high price range for high quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'high' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.167-0.30/Run')
    })

    it('should return medium price range for medium quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'medium' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.046-0.07/Run')
    })

    it('should return low price range for low quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'low' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.011-0.02/Run')
    })

    it('should return range when quality widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.011-0.30 x n/Run (varies with quality & n)')
    })
  })

  describe('dynamic pricing - IdeogramV3', () => {
    it('should return $0.09 for Quality rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Quality' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.09/Run')
    })

    it('should return $0.06 for Balanced rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Balanced' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.06/Run')
    })

    it('should return $0.03 for Turbo rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Turbo' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.03/Run')
    })

    it('should return range when rendering_speed widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$0.03-0.08 x num_images/Run (varies with rendering speed & num_images)'
      )
    })

    it('should multiply price by num_images for Quality rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Quality' },
        { name: 'num_images', value: 3 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.27/Run') // 0.09 * 3
    })

    it('should multiply price by num_images for Turbo rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Turbo' },
        { name: 'num_images', value: 5 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.15/Run') // 0.03 * 5
    })
  })

  describe('dynamic pricing - VeoVideoGenerationNode', () => {
    it('should return $5.00 for 10s duration', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('VeoVideoGenerationNode', [
        { name: 'duration_seconds', value: '10' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$5.00/Run')
    })

    it('should return $2.50 for 5s duration', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('VeoVideoGenerationNode', [
        { name: 'duration_seconds', value: '5' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$2.50/Run')
    })

    it('should return range when duration widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('VeoVideoGenerationNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$2.50-5.0/Run (varies with duration)')
    })
  })

  describe('dynamic pricing - Veo3VideoGenerationNode', () => {
    it('should return $2.00 for veo-3.0-fast-generate-001 without audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-fast-generate-001' },
        { name: 'generate_audio', value: false }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$2.00/Run')
    })

    it('should return $3.20 for veo-3.0-fast-generate-001 with audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-fast-generate-001' },
        { name: 'generate_audio', value: true }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$3.20/Run')
    })

    it('should return $4.00 for veo-3.0-generate-001 without audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-generate-001' },
        { name: 'generate_audio', value: false }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$4.00/Run')
    })

    it('should return $6.00 for veo-3.0-generate-001 with audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-generate-001' },
        { name: 'generate_audio', value: true }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$6.00/Run')
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$2.00-6.00/Run (varies with model & audio generation)'
      )
    })

    it('should return range when only model widget is present', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-generate-001' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$2.00-6.00/Run (varies with model & audio generation)'
      )
    })

    it('should return range when only generate_audio widget is present', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'generate_audio', value: true }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$2.00-6.00/Run (varies with model & audio generation)'
      )
    })
  })

  describe('dynamic pricing - LumaVideoNode', () => {
    it('should return $2.19 for ray-flash-2 4K 5s', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LumaVideoNode', [
        { name: 'model', value: 'ray-flash-2' },
        { name: 'resolution', value: '4K' },
        { name: 'duration', value: '5s' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$2.19/Run')
    })

    it('should return $6.37 for ray-2 4K 5s', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LumaVideoNode', [
        { name: 'model', value: 'ray-2' },
        { name: 'resolution', value: '4K' },
        { name: 'duration', value: '5s' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$6.37/Run')
    })

    it('should return $0.35 for ray-1-6 model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LumaVideoNode', [
        { name: 'model', value: 'ray-1-6' },
        { name: 'resolution', value: '1080p' },
        { name: 'duration', value: '5s' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.35/Run')
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LumaVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$0.14-11.47/Run (varies with model, resolution & duration)'
      )
    })
  })

  describe('dynamic pricing - PixverseTextToVideoNode', () => {
    it('should return range for 5s 1080p quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PixverseTextToVideoNode', [
        { name: 'duration', value: '5s' },
        { name: 'quality', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$0.45-1.2/Run (varies with duration, quality & motion mode)'
      )
    })

    it('should return range for 5s 540p normal quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PixverseTextToVideoNode', [
        { name: 'duration', value: '5s' },
        { name: 'quality', value: '540p' },
        { name: 'motion_mode', value: 'normal' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$0.45-1.2/Run (varies with duration, quality & motion mode)'
      )
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PixverseTextToVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        '$0.45-1.2/Run (varies with duration, quality & motion mode)'
      )
    })
  })

  describe('dynamic pricing - KlingDualCharacterVideoEffectNode', () => {
    it('should return range for v2-master 5s mode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingDualCharacterVideoEffectNode', [
        { name: 'mode', value: 'standard / 5s / v2-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.14-2.80/Run (varies with model, mode & duration)')
    })

    it('should return range for v1-6 5s mode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingDualCharacterVideoEffectNode', [
        { name: 'mode', value: 'standard / 5s / v1-6' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.14-2.80/Run (varies with model, mode & duration)')
    })

    it('should return range when mode widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingDualCharacterVideoEffectNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.14-2.80/Run (varies with model, mode & duration)')
    })
  })

  describe('dynamic pricing - KlingSingleImageVideoEffectNode', () => {
    it('should return $0.28 for fuzzyfuzzy effect', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingSingleImageVideoEffectNode', [
        { name: 'effect_scene', value: 'fuzzyfuzzy' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.28/Run')
    })

    it('should return $0.49 for dizzydizzy effect', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingSingleImageVideoEffectNode', [
        { name: 'effect_scene', value: 'dizzydizzy' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.49/Run')
    })

    it('should return range when effect_scene widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingSingleImageVideoEffectNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.28-0.49/Run (varies with effect scene)')
    })
  })

  describe('dynamic pricing - PikaImageToVideoNode2_2', () => {
    it('should return $0.45 for 5s 1080p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaImageToVideoNode2_2', [
        { name: 'duration', value: '5s' },
        { name: 'resolution', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.45/Run')
    })

    it('should return $0.2 for 5s 720p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaImageToVideoNode2_2', [
        { name: 'duration', value: '5s' },
        { name: 'resolution', value: '720p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.2/Run')
    })

    it('should return $1.0 for 10s 1080p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaImageToVideoNode2_2', [
        { name: 'duration', value: '10s' },
        { name: 'resolution', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$1.0/Run')
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaImageToVideoNode2_2', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.2-1.0/Run (varies with duration & resolution)')
    })
  })

  describe('dynamic pricing - PikaScenesV2_2', () => {
    it('should return $0.3 for 5s 720p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaScenesV2_2', [
        { name: 'duration', value: '5s' },
        { name: 'resolution', value: '720p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.3/Run')
    })

    it('should return $0.25 for 10s 720p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaScenesV2_2', [
        { name: 'duration', value: '10s' },
        { name: 'resolution', value: '720p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.4/Run')
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaScenesV2_2', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.2-1.0/Run (varies with duration & resolution)')
    })
  })

  describe('dynamic pricing - PikaStartEndFrameNode2_2', () => {
    it('should return $0.2 for 5s 720p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaStartEndFrameNode2_2', [
        { name: 'duration', value: '5s' },
        { name: 'resolution', value: '720p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.2/Run')
    })

    it('should return $1.0 for 10s 1080p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaStartEndFrameNode2_2', [
        { name: 'duration', value: '10s' },
        { name: 'resolution', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$1.0/Run')
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PikaStartEndFrameNode2_2', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.2-1.0/Run (varies with duration & resolution)')
    })
  })

  describe('error handling', () => {
    it('should gracefully handle errors in dynamic pricing functions', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      // Create a node with malformed widget data that could cause errors
      const node = {
        id: 'test-node',
        widgets: null, // This could cause errors when accessing .find()
        constructor: {
          nodeData: {
            name: 'KlingTextToVideoNode',
            api_node: true
          }
        }
      } as unknown as LGraphNode

      // Should not throw an error and return empty string as fallback
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.14-2.80/Run (varies with model, mode & duration)')
    })

    it('should handle completely broken widget structure', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      // Create a node with no widgets property at all
      const node = {
        id: 'test-node',
        // No widgets property
        constructor: {
          nodeData: {
            name: 'OpenAIDalle3',
            api_node: true
          }
        }
      } as unknown as LGraphNode

      // Should gracefully fall back to the default range
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.04-0.12/Run (varies with size & quality)')
    })
  })

  describe('helper methods', () => {
    describe('getNodePricingConfig', () => {
      it('should return pricing config for known API nodes', () => {
        const { getNodePricingConfig } = useNodePricing()
        const node = createMockNode('KlingTextToVideoNode')

        const config = getNodePricingConfig(node)
        expect(config).toBeDefined()
        expect(typeof config.displayPrice).toBe('function')
      })

      it('should return undefined for unknown nodes', () => {
        const { getNodePricingConfig } = useNodePricing()
        const node = createMockNode('UnknownNode')

        const config = getNodePricingConfig(node)
        expect(config).toBeUndefined()
      })
    })

    describe('getRelevantWidgetNames', () => {
      it('should return correct widget names for KlingTextToVideoNode', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('KlingTextToVideoNode')
        expect(widgetNames).toEqual(['mode', 'model_name', 'duration'])
      })

      it('should return correct widget names for KlingImage2VideoNode', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('KlingImage2VideoNode')
        expect(widgetNames).toEqual(['mode', 'model_name', 'duration'])
      })

      it('should return correct widget names for OpenAIDalle3', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('OpenAIDalle3')
        expect(widgetNames).toEqual(['size', 'quality'])
      })

      it('should return correct widget names for VeoVideoGenerationNode', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('VeoVideoGenerationNode')
        expect(widgetNames).toEqual(['duration_seconds'])
      })

      it('should return correct widget names for Veo3VideoGenerationNode', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('Veo3VideoGenerationNode')
        expect(widgetNames).toEqual(['model', 'generate_audio'])
      })

      it('should return correct widget names for LumaVideoNode', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('LumaVideoNode')
        expect(widgetNames).toEqual(['model', 'resolution', 'duration'])
      })

      it('should return correct widget names for KlingSingleImageVideoEffectNode', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames(
          'KlingSingleImageVideoEffectNode'
        )
        expect(widgetNames).toEqual(['effect_scene'])
      })

      it('should return correct widget names for PikaImageToVideoNode2_2', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('PikaImageToVideoNode2_2')
        expect(widgetNames).toEqual(['duration', 'resolution'])
      })

      it('should return empty array for unknown node types', () => {
        const { getRelevantWidgetNames } = useNodePricing()

        const widgetNames = getRelevantWidgetNames('UnknownNode')
        expect(widgetNames).toEqual([])
      })

      describe('Ideogram nodes with num_images parameter', () => {
        it('should return correct widget names for IdeogramV1', () => {
          const { getRelevantWidgetNames } = useNodePricing()

          const widgetNames = getRelevantWidgetNames('IdeogramV1')
          expect(widgetNames).toEqual(['num_images', 'turbo'])
        })

        it('should return correct widget names for IdeogramV2', () => {
          const { getRelevantWidgetNames } = useNodePricing()

          const widgetNames = getRelevantWidgetNames('IdeogramV2')
          expect(widgetNames).toEqual(['num_images', 'turbo'])
        })

        it('should return correct widget names for IdeogramV3', () => {
          const { getRelevantWidgetNames } = useNodePricing()

          const widgetNames = getRelevantWidgetNames('IdeogramV3')
          expect(widgetNames).toEqual(['rendering_speed', 'num_images'])
        })
      })

      describe('Recraft nodes with n parameter', () => {
        it('should return correct widget names for RecraftTextToImageNode', () => {
          const { getRelevantWidgetNames } = useNodePricing()

          const widgetNames = getRelevantWidgetNames('RecraftTextToImageNode')
          expect(widgetNames).toEqual(['n'])
        })

        it('should return correct widget names for RecraftTextToVectorNode', () => {
          const { getRelevantWidgetNames } = useNodePricing()

          const widgetNames = getRelevantWidgetNames('RecraftTextToVectorNode')
          expect(widgetNames).toEqual(['n'])
        })
      })
    })

    describe('Ideogram nodes dynamic pricing', () => {
      it('should calculate dynamic pricing for IdeogramV1 based on num_images value', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV1', [
          { name: 'num_images', value: 3 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.18/Run') // 0.06 * 3
      })

      it('should calculate dynamic pricing for IdeogramV2 based on num_images value', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV2', [
          { name: 'num_images', value: 4 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.32/Run') // 0.08 * 4
      })

      it('should fall back to static display when num_images widget is missing for IdeogramV1', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV1', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.02-0.06 x num_images/Run')
      })

      it('should fall back to static display when num_images widget is missing for IdeogramV2', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV2', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.05-0.08 x num_images/Run')
      })

      it('should handle edge case when num_images value is 1 for IdeogramV1', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV1', [
          { name: 'num_images', value: 1 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.06/Run') // 0.06 * 1 (turbo=false by default)
      })
    })

    describe('Recraft nodes dynamic pricing', () => {
      it('should calculate dynamic pricing for RecraftTextToImageNode based on n value', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftTextToImageNode', [
          { name: 'n', value: 3 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.12/Run') // 0.04 * 3
      })

      it('should calculate dynamic pricing for RecraftTextToVectorNode based on n value', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftTextToVectorNode', [
          { name: 'n', value: 2 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.16/Run') // 0.08 * 2
      })

      it('should fall back to static display when n widget is missing', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftTextToImageNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.04 x n/Run')
      })

      it('should handle edge case when n value is 1', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftImageInpaintingNode', [
          { name: 'n', value: 1 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.04/Run') // 0.04 * 1
      })
    })
  })

  describe('OpenAI nodes dynamic pricing with n parameter', () => {
    it('should calculate dynamic pricing for OpenAIDalle2 based on size and n', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '1024x1024' },
        { name: 'n', value: 3 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.060/Run') // 0.02 * 3
    })

    it('should calculate dynamic pricing for OpenAIGPTImage1 based on quality and n', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'low' },
        { name: 'n', value: 2 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.011-0.02 x 2/Run')
    })

    it('should fall back to static display when n widget is missing for OpenAIDalle2', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '512x512' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.018/Run') // n defaults to 1
    })
  })

  describe('KlingImageGenerationNode dynamic pricing with n parameter', () => {
    it('should calculate dynamic pricing for text-to-image with kling-v1', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImageGenerationNode', [
        { name: 'model_name', value: 'kling-v1' },
        { name: 'n', value: 4 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.0140/Run') // 0.0035 * 4
    })

    it('should calculate dynamic pricing for text-to-image with kling-v1-5', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      // Mock node without image input (text-to-image mode)
      const node = createMockNode('KlingImageGenerationNode', [
        { name: 'model_name', value: 'kling-v1-5' },
        { name: 'n', value: 2 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.0280/Run') // For kling-v1-5 text-to-image: 0.014 * 2
    })

    it('should fall back to static display when model widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImageGenerationNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.0035-0.028 x n/Run (varies with modality & model)')
    })
  })

  describe('New Recraft nodes dynamic pricing', () => {
    it('should calculate dynamic pricing for RecraftGenerateImageNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('RecraftGenerateImageNode', [
        { name: 'n', value: 3 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.12/Run') // 0.04 * 3
    })

    it('should calculate dynamic pricing for RecraftVectorizeImageNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('RecraftVectorizeImageNode', [
        { name: 'n', value: 5 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.05/Run') // 0.01 * 5
    })

    it('should calculate dynamic pricing for RecraftGenerateVectorImageNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('RecraftGenerateVectorImageNode', [
        { name: 'n', value: 2 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.16/Run') // 0.08 * 2
    })
  })

  describe('Widget names for reactive updates', () => {
    it('should include n parameter for OpenAI nodes', () => {
      const { getRelevantWidgetNames } = useNodePricing()

      expect(getRelevantWidgetNames('OpenAIDalle2')).toEqual(['size', 'n'])
      expect(getRelevantWidgetNames('OpenAIGPTImage1')).toEqual([
        'quality',
        'n'
      ])
    })

    it('should include n parameter for Kling and new Recraft nodes', () => {
      const { getRelevantWidgetNames } = useNodePricing()

      expect(getRelevantWidgetNames('KlingImageGenerationNode')).toEqual([
        'modality',
        'model_name',
        'n'
      ])
      expect(getRelevantWidgetNames('RecraftVectorizeImageNode')).toEqual(['n'])
      expect(getRelevantWidgetNames('RecraftGenerateImageNode')).toEqual(['n'])
      expect(getRelevantWidgetNames('RecraftGenerateVectorImageNode')).toEqual([
        'n'
      ])
      expect(
        getRelevantWidgetNames('RecraftGenerateColorFromImageNode')
      ).toEqual(['n'])
    })

    it('should include relevant widget names for new nodes', () => {
      const { getRelevantWidgetNames } = useNodePricing()

      expect(getRelevantWidgetNames('RunwayImageToVideoNodeGen3a')).toEqual([
        'duration'
      ])
      expect(getRelevantWidgetNames('RunwayImageToVideoNodeGen4')).toEqual([
        'duration'
      ])
      expect(getRelevantWidgetNames('RunwayFirstLastFrameNode')).toEqual([
        'duration'
      ])
      expect(getRelevantWidgetNames('TripoTextToModelNode')).toEqual([
        'quad',
        'style',
        'texture',
        'texture_quality'
      ])
      expect(getRelevantWidgetNames('TripoImageToModelNode')).toEqual([
        'quad',
        'style',
        'texture',
        'texture_quality'
      ])
    })
  })

  describe('New API nodes pricing', () => {
    describe('RunwayML nodes', () => {
      it('should return static price for RunwayTextToImageNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayTextToImageNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.08/Run')
      })

      it('should calculate dynamic pricing for RunwayImageToVideoNodeGen3a', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [
          { name: 'duration', value: 10 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.50/Run') // 0.05 * 10
      })

      it('should return fallback for RunwayImageToVideoNodeGen3a without duration', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.05/second')
      })

      it('should handle zero duration for RunwayImageToVideoNodeGen3a', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [
          { name: 'duration', value: 0 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.00/Run') // 0.05 * 0 = 0
      })

      it('should handle NaN duration for RunwayImageToVideoNodeGen3a', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [
          { name: 'duration', value: 'invalid' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.25/Run') // Falls back to 5 seconds: 0.05 * 5
      })
    })

    describe('Rodin nodes', () => {
      it('should return base price for Rodin3D_Regular', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('Rodin3D_Regular')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.4/Run')
      })

      it('should return addon price for Rodin3D_Detail', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('Rodin3D_Detail')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.4/Run')
      })

      it('should return addon price for Rodin3D_Smooth', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('Rodin3D_Smooth')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.4/Run')
      })
    })

    describe('Tripo nodes', () => {
      it('should return v2.5 standard pricing for TripoTextToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'quad', value: false },
          { name: 'style', value: 'any style' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'standard' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.15/Run') // any style, no quad, no texture
      })

      it('should return v2.5 detailed pricing for TripoTextToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'quad', value: true },
          { name: 'style', value: 'any style' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'detailed' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.35/Run') // any style, quad, no texture, detailed
      })

      it('should return v2.0 detailed pricing for TripoImageToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoImageToModelNode', [
          { name: 'quad', value: true },
          { name: 'style', value: 'any style' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'detailed' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.45/Run') // any style, quad, no texture, detailed
      })

      it('should return legacy pricing for TripoTextToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'quad', value: false },
          { name: 'style', value: 'none' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'standard' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.10/Run') // none style, no quad, no texture
      })

      it('should return static price for TripoRefineNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoRefineNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.3/Run')
      })

      it('should return fallback for TripoTextToModelNode without model', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          '$0.1-0.4/Run (varies with quad, style, texture & quality)'
        )
      })

      it('should return texture-based pricing for TripoTextureNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const standardNode = createMockNode('TripoTextureNode', [
          { name: 'texture_quality', value: 'standard' }
        ])
        const detailedNode = createMockNode('TripoTextureNode', [
          { name: 'texture_quality', value: 'detailed' }
        ])

        expect(getNodeDisplayPrice(standardNode)).toBe('$0.1/Run')
        expect(getNodeDisplayPrice(detailedNode)).toBe('$0.2/Run')
      })

      it('should handle various Tripo parameter combinations', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        // Test different parameter combinations
        const testCases = [
          { quad: false, style: 'none', texture: false, expected: '$0.10/Run' },
          {
            quad: false,
            style: 'any style',
            texture: false,
            expected: '$0.15/Run'
          },
          { quad: true, style: 'none', texture: false, expected: '$0.20/Run' },
          {
            quad: true,
            style: 'any style',
            texture: false,
            expected: '$0.25/Run'
          }
        ]

        testCases.forEach(({ quad, style, texture, expected }) => {
          const node = createMockNode('TripoTextToModelNode', [
            { name: 'quad', value: quad },
            { name: 'style', value: style },
            { name: 'texture', value: texture },
            { name: 'texture_quality', value: 'standard' }
          ])
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })

      it('should return static price for TripoConvertModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoConvertModelNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.10/Run')
      })

      it('should return static price for TripoRetargetRiggedModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoRetargetRiggedModelNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.10/Run')
      })

      it('should return dynamic pricing for TripoMultiviewToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        // Test basic case - no style, no quad, no texture
        const basicNode = createMockNode('TripoMultiviewToModelNode', [
          { name: 'quad', value: false },
          { name: 'style', value: 'none' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'standard' }
        ])
        expect(getNodeDisplayPrice(basicNode)).toBe('$0.20/Run')

        // Test high-end case - any style, quad, texture, detailed
        const highEndNode = createMockNode('TripoMultiviewToModelNode', [
          { name: 'quad', value: true },
          { name: 'style', value: 'stylized' },
          { name: 'texture', value: true },
          { name: 'texture_quality', value: 'detailed' }
        ])
        expect(getNodeDisplayPrice(highEndNode)).toBe('$0.50/Run')
      })

      it('should return fallback for TripoMultiviewToModelNode without widgets', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoMultiviewToModelNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          '$0.2-0.5/Run (varies with quad, style, texture & quality)'
        )
      })
    })

    describe('Gemini and OpenAI Chat nodes', () => {
      it('should return specific pricing for supported Gemini models', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        const testCases = [
          {
            model: 'gemini-2.5-pro-preview-05-06',
            expected: '$0.00125/$0.01 per 1K tokens'
          },
          {
            model: 'gemini-2.5-pro',
            expected: '$0.00125/$0.01 per 1K tokens'
          },
          {
            model: 'gemini-2.5-flash-preview-04-17',
            expected: '$0.0003/$0.0025 per 1K tokens'
          },
          {
            model: 'gemini-2.5-flash',
            expected: '$0.0003/$0.0025 per 1K tokens'
          },
          { model: 'unknown-gemini-model', expected: 'Token-based' }
        ]

        testCases.forEach(({ model, expected }) => {
          const node = createMockNode('GeminiNode', [
            { name: 'model', value: model }
          ])
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })

      it('should return per-second pricing for Gemini Veo models', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('GeminiNode', [
          { name: 'model', value: 'veo-2.0-generate-001' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('$0.5/second')
      })

      it('should return fallback for GeminiNode without model widget', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('GeminiNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('Token-based')
      })

      it('should return token-based pricing for OpenAIChatNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('OpenAIChatNode', [
          { name: 'model', value: 'unknown-model' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('Token-based')
      })

      it('should return correct pricing for all exposed OpenAI models', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        const testCases = [
          { model: 'o4-mini', expected: '$0.0011/$0.0044 per 1K tokens' },
          { model: 'o1-pro', expected: '$0.15/$0.60 per 1K tokens' },
          { model: 'o1', expected: '$0.015/$0.06 per 1K tokens' },
          { model: 'o3-mini', expected: '$0.0011/$0.0044 per 1K tokens' },
          { model: 'o3', expected: '$0.01/$0.04 per 1K tokens' },
          { model: 'gpt-4o', expected: '$0.0025/$0.01 per 1K tokens' },
          { model: 'gpt-4.1-nano', expected: '$0.0001/$0.0004 per 1K tokens' },
          { model: 'gpt-4.1-mini', expected: '$0.0004/$0.0016 per 1K tokens' },
          { model: 'gpt-4.1', expected: '$0.002/$0.008 per 1K tokens' },
          { model: 'gpt-5-nano', expected: '$0.00005/$0.0004 per 1K tokens' },
          { model: 'gpt-5-mini', expected: '$0.00025/$0.002 per 1K tokens' },
          { model: 'gpt-5', expected: '$0.00125/$0.01 per 1K tokens' }
        ]

        testCases.forEach(({ model, expected }) => {
          const node = createMockNode('OpenAIChatNode', [
            { name: 'model', value: model }
          ])
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })

      it('should handle model ordering correctly (specific before general)', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        // Test that more specific patterns are matched before general ones
        const testCases = [
          {
            model: 'gpt-4.1-nano-test',
            expected: '$0.0001/$0.0004 per 1K tokens'
          },
          {
            model: 'gpt-4.1-mini-test',
            expected: '$0.0004/$0.0016 per 1K tokens'
          },
          { model: 'gpt-4.1-test', expected: '$0.002/$0.008 per 1K tokens' },
          { model: 'o1-pro-test', expected: '$0.15/$0.60 per 1K tokens' },
          { model: 'o1-test', expected: '$0.015/$0.06 per 1K tokens' },
          { model: 'o3-mini-test', expected: '$0.0011/$0.0044 per 1K tokens' },
          { model: 'unknown-model', expected: 'Token-based' }
        ]

        testCases.forEach(({ model, expected }) => {
          const node = createMockNode('OpenAIChatNode', [
            { name: 'model', value: model }
          ])
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })

      it('should return fallback for OpenAIChatNode without model widget', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('OpenAIChatNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe('Token-based')
      })
    })

    describe('Additional RunwayML edge cases', () => {
      it('should handle edge cases for RunwayML duration-based pricing', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        // Test edge cases
        const testCases = [
          { duration: 0, expected: '$0.00/Run' }, // Now correctly handles 0 duration
          { duration: 1, expected: '$0.05/Run' },
          { duration: 30, expected: '$1.50/Run' }
        ]

        testCases.forEach(({ duration, expected }) => {
          const node = createMockNode('RunwayImageToVideoNodeGen3a', [
            { name: 'duration', value: duration }
          ])
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })

      it('should handle invalid duration values gracefully', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [
          { name: 'duration', value: 'invalid-string' }
        ])
        // When Number('invalid-string') returns NaN, it falls back to 5 seconds
        expect(getNodeDisplayPrice(node)).toBe('$0.25/Run')
      })

      it('should handle missing duration widget gracefully', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const nodes = [
          'RunwayImageToVideoNodeGen3a',
          'RunwayImageToVideoNodeGen4',
          'RunwayFirstLastFrameNode'
        ]

        nodes.forEach((nodeType) => {
          const node = createMockNode(nodeType, [])
          expect(getNodeDisplayPrice(node)).toBe('$0.05/second')
        })
      })
    })

    describe('Complete Rodin node coverage', () => {
      it('should return correct pricing for all Rodin variants', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        const testCases = [
          { nodeType: 'Rodin3D_Regular', expected: '$0.4/Run' },
          { nodeType: 'Rodin3D_Sketch', expected: '$0.4/Run' },
          { nodeType: 'Rodin3D_Detail', expected: '$0.4/Run' },
          { nodeType: 'Rodin3D_Smooth', expected: '$0.4/Run' }
        ]

        testCases.forEach(({ nodeType, expected }) => {
          const node = createMockNode(nodeType)
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })
    })

    describe('Comprehensive Tripo edge case testing', () => {
      it('should handle TripoImageToModelNode with various parameter combinations', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        const testCases = [
          { quad: false, style: 'none', texture: false, expected: '$0.20/Run' },
          { quad: false, style: 'none', texture: true, expected: '$0.25/Run' },
          {
            quad: true,
            style: 'any style',
            texture: true,
            textureQuality: 'detailed',
            expected: '$0.50/Run'
          },
          {
            quad: true,
            style: 'any style',
            texture: false,
            textureQuality: 'standard',
            expected: '$0.35/Run'
          }
        ]

        testCases.forEach(
          ({ quad, style, texture, textureQuality, expected }) => {
            const widgets = [
              { name: 'quad', value: quad },
              { name: 'style', value: style },
              { name: 'texture', value: texture }
            ]
            if (textureQuality) {
              widgets.push({ name: 'texture_quality', value: textureQuality })
            }
            const node = createMockNode('TripoImageToModelNode', widgets)
            expect(getNodeDisplayPrice(node)).toBe(expected)
          }
        )
      })

      it('should return correct fallback for TripoImageToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoImageToModelNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          '$0.2-0.5/Run (varies with quad, style, texture & quality)'
        )
      })

      it('should handle missing texture quality widget', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          '$0.1-0.4/Run (varies with quad, style, texture & quality)'
        )
      })

      it('should handle missing model version widget', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'texture_quality', value: 'detailed' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          '$0.1-0.4/Run (varies with quad, style, texture & quality)'
        )
      })
    })
  })
})
