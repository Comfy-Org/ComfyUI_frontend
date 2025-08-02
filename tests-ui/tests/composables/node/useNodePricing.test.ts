import type { LGraphNode } from '@comfyorg/litegraph'
import type { IComboWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { describe, expect, it } from 'vitest'

import { useNodePricing } from '@/composables/node/useNodePricing'

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

  describe('dynamic pricing - OpenAIDalle2', () => {
    it('should return $0.02 for 1024x1024 size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '1024x1024' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.02/Run')
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
      expect(price).toBe('$0.016-0.02/Run (varies with size)')
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
      expect(price).toBe('$0.011-0.30/Run (varies with quality)')
    })
  })

  describe('dynamic pricing - IdeogramV3', () => {
    it('should return $0.08 for Quality rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Quality' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('$0.08/Run')
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
      expect(price).toBe('$0.03-0.08/Run (varies with rendering speed)')
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
      expect(price).toBe('$0.25/Run')
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
})
