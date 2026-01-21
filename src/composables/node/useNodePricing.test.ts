import { describe, expect, it } from 'vitest'

import { formatCreditsFromUsd } from '@/base/credits/comfyCredits'
import { useNodePricing } from '@/composables/node/useNodePricing'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'

interface MockNodeInput {
  name: string
  link?: number | null
  links?: number[]
}

// Helper function to create a mock node
function createMockNode(
  nodeTypeName: string,
  widgets: Array<{ name: string; value: unknown }> = [],
  isApiNode = true,
  inputs: Array<{
    name: string
    connected?: boolean
    useLinksArray?: boolean
  }> = []
): LGraphNode {
  const mockWidgets = widgets.map(({ name, value }) => ({
    name,
    value,
    type: 'combo'
  })) as IComboWidget[]

  const mockInputs: MockNodeInput[] | undefined =
    inputs.length > 0
      ? inputs.map(({ name, connected, useLinksArray }) =>
          useLinksArray
            ? { name, links: connected ? [1] : [] }
            : { name, link: connected ? 1 : null }
        )
      : undefined

  const node = {
    id: Math.random().toString(),
    widgets: mockWidgets,
    constructor: {
      nodeData: {
        name: nodeTypeName,
        api_node: isApiNode
      }
    }
  }

  if (mockInputs) {
    Object.assign(node, {
      inputs: mockInputs,
      // Provide the common helpers some frontend code may call
      findInputSlot(portName: string) {
        return (
          this.inputs?.findIndex((i: MockNodeInput) => i.name === portName) ??
          -1
        )
      },
      isInputConnected(idx: number): boolean {
        const port = this.inputs?.[idx]
        if (!port) return false
        if (typeof port.link !== 'undefined') return port.link != null
        if (Array.isArray(port.links)) return port.links.length > 0
        return false
      }
    })
  }

  return node as unknown as LGraphNode
}

describe('useNodePricing', () => {
  describe('static pricing', () => {
    it('should return static price for FluxProCannyNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('FluxProCannyNode')

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05))
    })

    it('should return static price for StabilityStableImageUltraNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('StabilityStableImageUltraNode')

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.08))
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

  describe('dynamic pricing - Flux2ProImageNode', () => {
    it('should return precise price for text-to-image 1024x1024 (no refs)', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Flux2ProImageNode', [
        { name: 'width', value: 1024 },
        { name: 'height', value: 1024 }
      ])

      // 1024x1024 => 1 MP => $0.03
      expect(getNodeDisplayPrice(node)).toBe(creditsLabel(0.03))
    })

    it('should return minimum estimate when refs are connected (1024x1024)', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode(
        'Flux2ProImageNode',
        [
          { name: 'width', value: 1024 },
          { name: 'height', value: 1024 }
        ],
        true,
        // connect the 'images' input
        [{ name: 'images', connected: true }]
      )

      // 1024x1024 => 1 MP output = $0.03, min input add = $0.015 => ~$0.045 min
      expect(getNodeDisplayPrice(node)).toBe(
        creditsRangeLabel(0.045, 0.15, { approximate: true })
      )
    })

    it('should show fallback when width/height are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Flux2ProImageNode', [])
      expect(getNodeDisplayPrice(node)).toBe(creditsRangeLabel(0.03, 0.15))
    })
  })

  describe('dynamic pricing - KlingTextToVideoNode', () => {
    it('should return high price for kling-v2-1-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'standard / 5s / v2-1-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.4))
    })

    it('should return high price for kling-v2-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'standard / 5s / v2-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.4))
    })

    it('should return low price for kling-v2-turbo model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'pro / 5s / v2-5-turbo' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.35))
    })

    it('should return high price for kling-v2-turbo model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'pro / 10s / v2-5-turbo' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.7))
    })

    it('should return standard price for kling-v1-6 model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [
        { name: 'mode', value: 'standard / 5s / v1-6' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.28))
    })

    it('should return range when mode widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingTextToVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.14, 2.8, {
          note: '(varies with model, mode & duration)'
        })
      )
    })
  })

  describe('dynamic pricing - KlingImage2VideoNode', () => {
    it('should return high price for kling-v2-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [
        { name: 'model_name', value: 'v2-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.4))
    })

    it('should return high price for kling-v2-1-master model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [
        { name: 'model_name', value: 'v2-1-master' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.4))
    })

    it('should return high price for kling-v2-5-turbo model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [
        { name: 'model_name', value: 'v2-5-turbo' },
        { name: 'mode', value: 'pro mode / 10s duration / kling-v2-5-turbo' },
        { name: 'duration', value: '10' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.7))
    })

    it('should return standard price for kling-v1-6 model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [
        { name: 'model_name', value: 'v1-6' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.28))
    })

    it('should return range when model_name widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImage2VideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.14, 2.8, {
          note: '(varies with model, mode & duration)'
        })
      )
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
      expect(price).toBe(creditsLabel(0.04))
    })

    it('should return $0.08 for 1024x1024 hd quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1024' },
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.08))
    })

    it('should return $0.08 for 1792x1024 standard quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1792x1024' },
        { name: 'quality', value: 'standard' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.08))
    })

    it('should return $0.16 for 1792x1024 hd quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1792x1024' },
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.12))
    })

    it('should return $0.08 for 1024x1792 standard quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1792' },
        { name: 'quality', value: 'standard' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.08))
    })

    it('should return $0.16 for 1024x1792 hd quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1792' },
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.12))
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.04, 0.12, { note: '(varies with size & quality)' })
      )
    })

    it('should return range when size widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'quality', value: 'hd' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.04, 0.12, { note: '(varies with size & quality)' })
      )
    })

    it('should return range when quality widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle3', [
        { name: 'size', value: '1024x1024' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.04, 0.12, { note: '(varies with size & quality)' })
      )
    })
  })
  // ============================== OpenAIVideoSora2 ==============================
  describe('dynamic pricing - OpenAIVideoSora2', () => {
    it('should require model, duration & size when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [])
      expect(getNodeDisplayPrice(node)).toBe('Set model, duration & size')
    })

    it('should require duration when duration is invalid or zero', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const nodeNaN = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2-pro' },
        { name: 'duration', value: 'oops' },
        { name: 'size', value: '720x1280' }
      ])
      expect(getNodeDisplayPrice(nodeNaN)).toBe('Set model, duration & size')

      const nodeZero = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2-pro' },
        { name: 'duration', value: 0 },
        { name: 'size', value: '720x1280' }
      ])
      expect(getNodeDisplayPrice(nodeZero)).toBe('Set model, duration & size')
    })

    it('should require size when size is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2-pro' },
        { name: 'duration', value: 8 }
      ])
      expect(getNodeDisplayPrice(node)).toBe('Set model, duration & size')
    })

    it('should compute pricing for sora-2-pro with 1024x1792', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2-pro' },
        { name: 'duration', value: 8 },
        { name: 'size', value: '1024x1792' }
      ])
      expect(getNodeDisplayPrice(node)).toBe(creditsLabel(4.0)) // 0.5 * 8
    })

    it('should compute pricing for sora-2-pro with 720x1280', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2-pro' },
        { name: 'duration', value: 12 },
        { name: 'size', value: '720x1280' }
      ])
      expect(getNodeDisplayPrice(node)).toBe(creditsLabel(3.6)) // 0.3 * 12
    })

    it('should reject unsupported size for sora-2-pro', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2-pro' },
        { name: 'duration', value: 8 },
        { name: 'size', value: '640x640' }
      ])
      expect(getNodeDisplayPrice(node)).toBe(
        'Invalid size. Must be 720x1280, 1280x720, 1024x1792, or 1792x1024.'
      )
    })

    it('should compute pricing for sora-2 (720x1280 only)', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2' },
        { name: 'duration', value: 10 },
        { name: 'size', value: '720x1280' }
      ])
      expect(getNodeDisplayPrice(node)).toBe(creditsLabel(1.0)) // 0.1 * 10
    })

    it('should reject non-720 sizes for sora-2', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2' },
        { name: 'duration', value: 8 },
        { name: 'size', value: '1024x1792' }
      ])
      expect(getNodeDisplayPrice(node)).toBe(
        'sora-2 supports only 720x1280 or 1280x720'
      )
    })
    it('should accept duration_s alias for duration', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'sora-2-pro' },
        { name: 'duration_s', value: 4 },
        { name: 'size', value: '1792x1024' }
      ])
      expect(getNodeDisplayPrice(node)).toBe(creditsLabel(2.0)) // 0.5 * 4
    })

    it('should be case-insensitive for model and size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIVideoSora2', [
        { name: 'model', value: 'SoRa-2-PrO' },
        { name: 'duration', value: 12 },
        { name: 'size', value: '1280x720' }
      ])
      expect(getNodeDisplayPrice(node)).toBe(creditsLabel(3.6)) // 0.3 * 12
    })
  })

  // ============================== MinimaxHailuoVideoNode ==============================
  describe('dynamic pricing - MinimaxHailuoVideoNode', () => {
    it('should return $0.28 for 6s duration and 768P resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [
        { name: 'duration', value: '6' },
        { name: 'resolution', value: '768P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.28))
    })

    it('should return $0.60 for 10s duration and 768P resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [
        { name: 'duration', value: '10' },
        { name: 'resolution', value: '768P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.56))
    })

    it('should return $0.49 for 6s duration and 1080P resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [
        { name: 'duration', value: '6' },
        { name: 'resolution', value: '1080P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.49))
    })

    it('should return range when duration widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('MinimaxHailuoVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.28, 0.56, {
          note: '(varies with resolution & duration)'
        })
      )
    })
  })

  describe('dynamic pricing - OpenAIDalle2', () => {
    it('should return $0.02 for 1024x1024 size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '1024x1024' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.02))
    })

    it('should return $0.018 for 512x512 size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '512x512' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.018))
    })

    it('should return $0.016 for 256x256 size', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '256x256' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.016))
    })

    it('should return range when size widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.016, 0.02, {
          suffix: ' x n/Run',
          note: '(varies with size & n)'
        })
      )
    })
  })

  describe('dynamic pricing - OpenAIGPTImage1', () => {
    it('should return high price range for high quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'high' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.167, 0.3))
    })

    it('should return medium price range for medium quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'medium' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.046, 0.07))
    })

    it('should return low price range for low quality', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'low' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.011, 0.02))
    })

    it('should return range when quality widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.011, 0.3, {
          suffix: ' x n/Run',
          note: '(varies with quality & n)'
        })
      )
    })
  })

  describe('dynamic pricing - IdeogramV3', () => {
    it('should return correct prices for IdeogramV3 node', () => {
      const { getNodeDisplayPrice } = useNodePricing()

      const testCases = [
        {
          rendering_speed: 'Quality',
          character_image: false,
          expected: creditsLabel(0.13)
        },
        {
          rendering_speed: 'Quality',
          character_image: true,
          expected: creditsLabel(0.29)
        },
        {
          rendering_speed: 'Default',
          character_image: false,
          expected: creditsLabel(0.09)
        },
        {
          rendering_speed: 'Default',
          character_image: true,
          expected: creditsLabel(0.21)
        },
        {
          rendering_speed: 'Turbo',
          character_image: false,
          expected: creditsLabel(0.04)
        },
        {
          rendering_speed: 'Turbo',
          character_image: true,
          expected: creditsLabel(0.14)
        }
      ]

      testCases.forEach(({ rendering_speed, character_image, expected }) => {
        const node = createMockNode(
          'IdeogramV3',
          [{ name: 'rendering_speed', value: rendering_speed }],
          true,
          [{ name: 'character_image', connected: character_image }]
        )
        expect(getNodeDisplayPrice(node)).toBe(expected)
      })
    })

    it('should return range when rendering_speed widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.04, 0.11, {
          suffix: ' x num_images/Run',
          note: '(varies with rendering speed & num_images)'
        })
      )
    })

    it('should multiply price by num_images for Quality rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Quality' },
        { name: 'num_images', value: 3 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.39)) // 0.09 * 3 * 1.43
    })

    it('should multiply price by num_images for Turbo rendering speed', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('IdeogramV3', [
        { name: 'rendering_speed', value: 'Turbo' },
        { name: 'num_images', value: 5 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.21)) // 0.03 * 5 * 1.43
    })
  })

  describe('dynamic pricing - VeoVideoGenerationNode', () => {
    it('should return $5.00 for 10s duration', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('VeoVideoGenerationNode', [
        { name: 'duration_seconds', value: '10' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(5.0))
    })

    it('should return $2.50 for 5s duration', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('VeoVideoGenerationNode', [
        { name: 'duration_seconds', value: '5' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(2.5))
    })

    it('should return range when duration widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('VeoVideoGenerationNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(2.5, 5.0, { note: '(varies with duration)' })
      )
    })
  })

  describe('dynamic pricing - Veo3VideoGenerationNode', () => {
    it('should return $0.80 for veo-3.0-fast-generate-001 without audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-fast-generate-001' },
        { name: 'generate_audio', value: false }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.8))
    })

    it('should return $1.20 for veo-3.0-fast-generate-001 with audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-fast-generate-001' },
        { name: 'generate_audio', value: true }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.2))
    })

    it('should return $1.60 for veo-3.0-generate-001 without audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-generate-001' },
        { name: 'generate_audio', value: false }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.6))
    })

    it('should return $3.20 for veo-3.0-generate-001 with audio', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-generate-001' },
        { name: 'generate_audio', value: true }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(3.2))
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.8, 3.2, {
          note: 'varies with model & audio generation'
        })
      )
    })

    it('should return range when only model widget is present', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'model', value: 'veo-3.0-generate-001' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.8, 3.2, {
          note: 'varies with model & audio generation'
        })
      )
    })

    it('should return range when only generate_audio widget is present', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('Veo3VideoGenerationNode', [
        { name: 'generate_audio', value: true }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.8, 3.2, {
          note: 'varies with model & audio generation'
        })
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
      expect(price).toBe(creditsLabel(3.13))
    })

    it('should return $6.37 for ray-2 4K 5s', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LumaVideoNode', [
        { name: 'model', value: 'ray-2' },
        { name: 'resolution', value: '4K' },
        { name: 'duration', value: '5s' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(9.11))
    })

    it('should return $0.35 for ray-1-6 model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LumaVideoNode', [
        { name: 'model', value: 'ray-1-6' },
        { name: 'resolution', value: '1080p' },
        { name: 'duration', value: '5s' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.5))
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LumaVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.2, 16.4, {
          note: 'varies with model, resolution & duration'
        })
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
        creditsRangeLabel(0.45, 1.2, {
          note: 'varies with duration, quality & motion mode'
        })
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
        creditsRangeLabel(0.45, 1.2, {
          note: 'varies with duration, quality & motion mode'
        })
      )
    })

    it('should return range when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('PixverseTextToVideoNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.45, 1.2, {
          note: 'varies with duration, quality & motion mode'
        })
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
      expect(price).toBe(
        creditsRangeLabel(0.14, 2.8, {
          note: '(varies with model, mode & duration)'
        })
      )
    })

    it('should return range for v1-6 5s mode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingDualCharacterVideoEffectNode', [
        { name: 'mode', value: 'standard / 5s / v1-6' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.14, 2.8, {
          note: '(varies with model, mode & duration)'
        })
      )
    })

    it('should return range when mode widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingDualCharacterVideoEffectNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.14, 2.8, {
          note: '(varies with model, mode & duration)'
        })
      )
    })
  })

  describe('dynamic pricing - KlingSingleImageVideoEffectNode', () => {
    it('should return $0.28 for fuzzyfuzzy effect', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingSingleImageVideoEffectNode', [
        { name: 'effect_scene', value: 'fuzzyfuzzy' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.28))
    })

    it('should return $0.49 for dizzydizzy effect', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingSingleImageVideoEffectNode', [
        { name: 'effect_scene', value: 'dizzydizzy' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.49))
    })

    it('should return range when effect_scene widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingSingleImageVideoEffectNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.28, 0.49, { note: '(varies with effect scene)' })
      )
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
      expect(price).toBe(
        creditsRangeLabel(0.14, 2.8, {
          note: '(varies with model, mode & duration)'
        })
      )
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
      expect(price).toBe(
        creditsRangeLabel(0.04, 0.12, { note: '(varies with size & quality)' })
      )
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
          expect(widgetNames).toEqual([
            'rendering_speed',
            'num_images',
            'character_image'
          ])
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
        expect(price).toBe(creditsLabel(0.26)) // 0.06 * 3 * 1.43
      })

      it('should calculate dynamic pricing for IdeogramV2 based on num_images value', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV2', [
          { name: 'num_images', value: 4 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.46)) // 0.08 * 4 * 1.43
      })

      it('should fall back to static display when num_images widget is missing for IdeogramV1', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV1', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          creditsRangeLabel(0.03, 0.09, { suffix: ' x num_images/Run' })
        )
      })

      it('should fall back to static display when num_images widget is missing for IdeogramV2', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV2', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          creditsRangeLabel(0.07, 0.11, { suffix: ' x num_images/Run' })
        )
      })

      it('should handle edge case when num_images value is 1 for IdeogramV1', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('IdeogramV1', [
          { name: 'num_images', value: 1 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.09)) // 0.06 * 1 * 1.43 (turbo=false by default)
      })
    })

    describe('Recraft nodes dynamic pricing', () => {
      it('should calculate dynamic pricing for RecraftTextToImageNode based on n value', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftTextToImageNode', [
          { name: 'n', value: 3 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.12)) // 0.04 * 3
      })

      it('should calculate dynamic pricing for RecraftTextToVectorNode based on n value', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftTextToVectorNode', [
          { name: 'n', value: 2 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.16)) // 0.08 * 2
      })

      it('should fall back to static display when n widget is missing', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftTextToImageNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.04, { suffix: ' x n/Run' }))
      })

      it('should handle edge case when n value is 1', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RecraftImageInpaintingNode', [
          { name: 'n', value: 1 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.04)) // 0.04 * 1
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
      expect(price).toBe(creditsLabel(0.06)) // 0.02 * 3
    })

    it('should calculate dynamic pricing for OpenAIGPTImage1 based on quality and n', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIGPTImage1', [
        { name: 'quality', value: 'low' },
        { name: 'n', value: 2 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.011, 0.02, { suffix: ' x 2/Run' }))
    })

    it('should fall back to static display when n widget is missing for OpenAIDalle2', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('OpenAIDalle2', [
        { name: 'size', value: '512x512' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.018)) // n defaults to 1
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
      expect(price).toBe(creditsLabel(0.014)) // 0.0035 * 4
    })

    it('should calculate dynamic pricing for text-to-image with kling-v1-5', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      // Mock node without image input (text-to-image mode)
      const node = createMockNode('KlingImageGenerationNode', [
        { name: 'model_name', value: 'kling-v1-5' },
        { name: 'n', value: 2 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.028)) // For kling-v1-5 text-to-image: 0.014 * 2
    })

    it('should fall back to static display when model widget is missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('KlingImageGenerationNode', [])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsRangeLabel(0.0035, 0.028, {
          suffix: ' x n/Run',
          note: '(varies with modality & model)'
        })
      )
    })
  })

  describe('New Recraft nodes dynamic pricing', () => {
    it('should calculate dynamic pricing for RecraftGenerateImageNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('RecraftGenerateImageNode', [
        { name: 'n', value: 3 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.12)) // 0.04 * 3
    })

    it('should calculate dynamic pricing for RecraftVectorizeImageNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('RecraftVectorizeImageNode', [
        { name: 'n', value: 5 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05)) // 0.01 * 5
    })

    it('should calculate dynamic pricing for RecraftGenerateVectorImageNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('RecraftGenerateVectorImageNode', [
        { name: 'n', value: 2 }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.16)) // 0.08 * 2
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
        'model_version',
        'quad',
        'style',
        'texture',
        'pbr',
        'texture_quality',
        'geometry_quality'
      ])
      expect(getRelevantWidgetNames('TripoImageToModelNode')).toEqual([
        'model_version',
        'quad',
        'style',
        'texture',
        'pbr',
        'texture_quality',
        'geometry_quality'
      ])
    })
  })

  describe('New API nodes pricing', () => {
    describe('RunwayML nodes', () => {
      it('should return static price for RunwayTextToImageNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayTextToImageNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.11))
      })

      it('should calculate dynamic pricing for RunwayImageToVideoNodeGen3a', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [
          { name: 'duration', value: 10 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.0715 * 10))
      })

      it('should return fallback for RunwayImageToVideoNodeGen3a without duration', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.0715, { suffix: '/second' }))
      })

      it('should handle zero duration for RunwayImageToVideoNodeGen3a', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [
          { name: 'duration', value: 0 }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.0)) // 0.05 * 0 = 0
      })

      it('should handle NaN duration for RunwayImageToVideoNodeGen3a', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('RunwayImageToVideoNodeGen3a', [
          { name: 'duration', value: 'invalid' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.0715 * 5))
      })
    })

    describe('Rodin nodes', () => {
      it('should return base price for Rodin3D_Regular', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('Rodin3D_Regular')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.4))
      })

      it('should return addon price for Rodin3D_Detail', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('Rodin3D_Detail')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.4))
      })

      it('should return addon price for Rodin3D_Smooth', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('Rodin3D_Smooth')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.4))
      })
    })

    describe('Tripo nodes', () => {
      it('should return v2.5 standard pricing for TripoTextToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'model_version', value: 'v2.5' },
          { name: 'quad', value: false },
          { name: 'style', value: 'any style' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'standard' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.15)) // any style, no quad, no texture
      })

      it('should return v2.5 detailed pricing for TripoTextToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'model_version', value: 'v2.5' },
          { name: 'quad', value: true },
          { name: 'style', value: 'any style' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'detailed' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.3)) // any style, quad, no texture, detailed
      })

      it('should return v2.0 detailed pricing for TripoImageToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoImageToModelNode', [
          { name: 'model_version', value: 'v2.0' },
          { name: 'quad', value: true },
          { name: 'style', value: 'any style' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'detailed' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.4)) // any style, quad, no texture, detailed
      })

      it('should return legacy pricing for TripoTextToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'model_version', value: 'v2.0' },
          { name: 'quad', value: false },
          { name: 'style', value: 'none' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'standard' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.1)) // none style, no quad, no texture
      })

      it('should return static price for TripoRefineNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoRefineNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.3))
      })

      it('should return fallback for TripoTextToModelNode without model', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          creditsRangeLabel(0.1, 0.65, {
            note: 'varies with quad, style, texture & quality'
          })
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

        expect(getNodeDisplayPrice(standardNode)).toBe(creditsLabel(0.1))
        expect(getNodeDisplayPrice(detailedNode)).toBe(creditsLabel(0.2))
      })

      it('should handle various Tripo parameter combinations', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        // Test different parameter combinations
        const testCases = [
          {
            model_version: 'v3.0',
            quad: false,
            style: 'none',
            texture: false,
            expected: creditsLabel(0.1)
          },
          {
            model_version: 'v3.0',
            quad: false,
            style: 'any style',
            texture: false,
            expected: creditsLabel(0.15)
          },
          {
            model_version: 'v3.0',
            quad: true,
            style: 'any style',
            texture: false,
            expected: creditsLabel(0.2)
          },
          {
            model_version: 'v3.0',
            quad: true,
            style: 'any style',
            texture: true,
            expected: creditsLabel(0.3)
          }
        ]

        testCases.forEach(({ quad, style, texture, expected }) => {
          const node = createMockNode('TripoTextToModelNode', [
            { name: 'model_version', value: 'v2.0' },
            { name: 'quad', value: quad },
            { name: 'style', value: style },
            { name: 'texture', value: texture },
            { name: 'texture_quality', value: 'standard' }
          ])
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })

      it('should return static price for TripoRetargetNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoRetargetNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(creditsLabel(0.1))
      })

      it('should return dynamic pricing for TripoMultiviewToModelNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        // Test basic case - no style, no quad, no texture
        const basicNode = createMockNode('TripoMultiviewToModelNode', [
          { name: 'model_version', value: 'v3.0' },
          { name: 'quad', value: false },
          { name: 'style', value: 'none' },
          { name: 'texture', value: false },
          { name: 'texture_quality', value: 'standard' }
        ])
        expect(getNodeDisplayPrice(basicNode)).toBe(creditsLabel(0.2))

        // Test high-end case - any style, quad, texture, detailed
        const highEndNode = createMockNode('TripoMultiviewToModelNode', [
          { name: 'model_version', value: 'v3.0' },
          { name: 'quad', value: true },
          { name: 'style', value: 'stylized' },
          { name: 'texture', value: true },
          { name: 'texture_quality', value: 'detailed' }
        ])
        expect(getNodeDisplayPrice(highEndNode)).toBe(creditsLabel(0.5))
      })

      it('should return fallback for TripoMultiviewToModelNode without widgets', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoMultiviewToModelNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          creditsRangeLabel(0.1, 0.65, {
            note: '(varies with quad, style, texture & quality)'
          })
        )
      })
    })

    describe('Gemini and OpenAI Chat nodes', () => {
      it('should return specific pricing for supported Gemini models', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        const testCases = [
          {
            model: 'gemini-2.5-pro-preview-05-06',
            expected: creditsListLabel([0.00125, 0.01], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gemini-2.5-pro',
            expected: creditsListLabel([0.00125, 0.01], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gemini-3-pro-preview',
            expected: creditsListLabel([0.002, 0.012], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gemini-2.5-flash-preview-04-17',
            expected: creditsListLabel([0.0003, 0.0025], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gemini-2.5-flash',
            expected: creditsListLabel([0.0003, 0.0025], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
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
          {
            model: 'o4-mini',
            expected: creditsListLabel([0.0011, 0.0044], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'o1-pro',
            expected: creditsListLabel([0.15, 0.6], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'o1',
            expected: creditsListLabel([0.015, 0.06], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'o3-mini',
            expected: creditsListLabel([0.0011, 0.0044], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'o3',
            expected: creditsListLabel([0.01, 0.04], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-4o',
            expected: creditsListLabel([0.0025, 0.01], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-4.1-nano',
            expected: creditsListLabel([0.0001, 0.0004], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-4.1-mini',
            expected: creditsListLabel([0.0004, 0.0016], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-4.1',
            expected: creditsListLabel([0.002, 0.008], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-5-nano',
            expected: creditsListLabel([0.00005, 0.0004], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-5-mini',
            expected: creditsListLabel([0.00025, 0.002], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-5',
            expected: creditsListLabel([0.00125, 0.01], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          }
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
            expected: creditsListLabel([0.0001, 0.0004], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-4.1-mini-test',
            expected: creditsListLabel([0.0004, 0.0016], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'gpt-4.1-test',
            expected: creditsListLabel([0.002, 0.008], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'o1-pro-test',
            expected: creditsListLabel([0.15, 0.6], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'o1-test',
            expected: creditsListLabel([0.015, 0.06], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
          {
            model: 'o3-mini-test',
            expected: creditsListLabel([0.0011, 0.0044], {
              suffix: ' per 1K tokens',
              approximate: true,
              separator: '-'
            })
          },
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

      it('should return static price for GeminiImageNode', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('GeminiImageNode')

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          creditsLabel(0.039, {
            approximate: true,
            suffix: '/Image (1K)'
          })
        )
      })
    })

    describe('Additional RunwayML edge cases', () => {
      it('should handle edge cases for RunwayML duration-based pricing', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        // Test edge cases
        const RATE_PER_SECOND = 0.0715
        const testCases = [
          { duration: 0, expected: creditsLabel(0) },
          { duration: 1, expected: creditsLabel(RATE_PER_SECOND) },
          { duration: 30, expected: creditsLabel(RATE_PER_SECOND * 30) }
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
        expect(getNodeDisplayPrice(node)).toBe(creditsLabel(0.0715 * 5))
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
          expect(getNodeDisplayPrice(node)).toBe(
            creditsLabel(0.0715, { suffix: '/second' })
          )
        })
      })
    })

    describe('Complete Rodin node coverage', () => {
      it('should return correct pricing for all Rodin variants', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        const testCases = [
          { nodeType: 'Rodin3D_Regular', expected: creditsLabel(0.4) },
          { nodeType: 'Rodin3D_Sketch', expected: creditsLabel(0.4) },
          { nodeType: 'Rodin3D_Detail', expected: creditsLabel(0.4) },
          { nodeType: 'Rodin3D_Smooth', expected: creditsLabel(0.4) }
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
          {
            quad: false,
            style: 'none',
            texture: false,
            expected: creditsLabel(0.2)
          },
          {
            quad: false,
            style: 'none',
            texture: true,
            expected: creditsLabel(0.3)
          },
          {
            quad: true,
            style: 'any style',
            texture: true,
            textureQuality: 'detailed',
            expected: creditsLabel(0.5)
          },
          {
            quad: false,
            style: 'any style',
            texture: true,
            textureQuality: 'standard',
            expected: creditsLabel(0.35)
          }
        ]

        testCases.forEach(
          ({ quad, style, texture, textureQuality, expected }) => {
            const widgets = [
              { name: 'model_version', value: 'v3.0' },
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
          creditsRangeLabel(0.1, 0.65, {
            note: 'varies with quad, style, texture & quality'
          })
        )
      })

      it('should handle missing texture quality widget', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          creditsRangeLabel(0.1, 0.65, {
            note: 'varies with quad, style, texture & quality'
          })
        )
      })

      it('should handle missing model version widget', () => {
        const { getNodeDisplayPrice } = useNodePricing()
        const node = createMockNode('TripoTextToModelNode', [
          { name: 'texture_quality', value: 'detailed' }
        ])

        const price = getNodeDisplayPrice(node)
        expect(price).toBe(
          creditsRangeLabel(0.1, 0.65, {
            note: 'varies with quad, style, texture & quality'
          })
        )
      })

      it('should return correct pricing for exposed ByteDance models', () => {
        const { getNodeDisplayPrice } = useNodePricing()

        const testCases = [
          {
            node_name: 'ByteDanceImageNode',
            model: 'seedream-3-0-t2i-250415',
            expected: creditsLabel(0.03)
          },
          {
            node_name: 'ByteDanceImageEditNode',
            model: 'seededit-3-0-i2i-250628',
            expected: creditsLabel(0.03)
          }
        ]

        testCases.forEach(({ node_name, model, expected }) => {
          const node = createMockNode(node_name, [
            { name: 'model', value: model }
          ])
          expect(getNodeDisplayPrice(node)).toBe(expected)
        })
      })
    })
  })

  describe('dynamic pricing - ByteDanceSeedreamNode', () => {
    it('should return $0.03 x images/Run', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('ByteDanceSeedreamNode', [
        { name: 'model', value: 'seedream-4-0-250828' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(
        creditsLabel(0.03, {
          suffix: ' x images/Run',
          approximate: true
        })
      )
    })
  })

  describe('dynamic pricing - ByteDance Seedance video nodes', () => {
    it('should return base 10s range for PRO 1080p on ByteDanceTextToVideoNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('ByteDanceTextToVideoNode', [
        { name: 'model', value: 'seedance-1-0-pro' },
        { name: 'duration', value: '10' },
        { name: 'resolution', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(1.18, 1.22))
    })

    it('should scale to half for 5s PRO 1080p on ByteDanceTextToVideoNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('ByteDanceTextToVideoNode', [
        { name: 'model', value: 'seedance-1-0-pro' },
        { name: 'duration', value: '5' },
        { name: 'resolution', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.59, 0.61))
    })

    it('should scale for 8s PRO 480p on ByteDanceImageToVideoNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('ByteDanceImageToVideoNode', [
        { name: 'model', value: 'seedance-1-0-pro' },
        { name: 'duration', value: '8' },
        { name: 'resolution', value: '480p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.23 * 0.8, 0.24 * 0.8))
    })

    it('should scale correctly for 12s PRO 720p on ByteDanceFirstLastFrameNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('ByteDanceFirstLastFrameNode', [
        { name: 'model', value: 'seedance-1-0-pro' },
        { name: 'duration', value: '10' },
        { name: 'resolution', value: '720p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.51, 0.56))
    })

    it('should collapse to a single value when min and max round equal for LITE 480p 3s on ByteDanceImageReferenceNode', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('ByteDanceImageReferenceNode', [
        { name: 'model', value: 'seedance-1-0-lite' },
        { name: 'duration', value: '3' },
        { name: 'resolution', value: '480p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05)) // 0.17..0.18 scaled by 0.3 both round to 0.05
    })

    it('should return Token-based when required widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const missingModel = createMockNode('ByteDanceFirstLastFrameNode', [
        { name: 'duration', value: '10' },
        { name: 'resolution', value: '1080p' }
      ])
      const missingResolution = createMockNode('ByteDanceImageToVideoNode', [
        { name: 'model', value: 'seedance-1-0-pro' },
        { name: 'duration', value: '10' }
      ])
      const missingDuration = createMockNode('ByteDanceTextToVideoNode', [
        { name: 'model', value: 'seedance-1-0-lite' },
        { name: 'resolution', value: '720p' }
      ])

      expect(getNodeDisplayPrice(missingModel)).toBe('Token-based')
      expect(getNodeDisplayPrice(missingResolution)).toBe('Token-based')
      expect(getNodeDisplayPrice(missingDuration)).toBe('Token-based')
    })
  })

  describe('dynamic pricing - WanTextToVideoApi', () => {
    it('should return $1.50 for 10s at 1080p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanTextToVideoApi', [
        { name: 'duration', value: '10' },
        { name: 'size', value: '1080p: 4:3 (1632x1248)' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.5)) // 0.15 * 10
    })

    it('should return $0.50 for 5s at 720p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanTextToVideoApi', [
        { name: 'duration', value: 5 },
        { name: 'size', value: '720p: 16:9 (1280x720)' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.5)) // 0.10 * 5
    })

    it('should return $0.15 for 3s at 480p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanTextToVideoApi', [
        { name: 'duration', value: '3' },
        { name: 'size', value: '480p: 1:1 (624x624)' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.15)) // 0.05 * 3
    })

    it('should fall back when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const missingBoth = createMockNode('WanTextToVideoApi', [])
      const missingSize = createMockNode('WanTextToVideoApi', [
        { name: 'duration', value: '5' }
      ])
      const missingDuration = createMockNode('WanTextToVideoApi', [
        { name: 'size', value: '1080p' }
      ])

      expect(getNodeDisplayPrice(missingBoth)).toBe(
        creditsRangeLabel(0.05, 0.15, { suffix: '/second' })
      )
      expect(getNodeDisplayPrice(missingSize)).toBe(
        creditsRangeLabel(0.05, 0.15, { suffix: '/second' })
      )
      expect(getNodeDisplayPrice(missingDuration)).toBe(
        creditsRangeLabel(0.05, 0.15, { suffix: '/second' })
      )
    })

    it('should fall back on invalid duration', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanTextToVideoApi', [
        { name: 'duration', value: 'invalid' },
        { name: 'size', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.05, 0.15, { suffix: '/second' }))
    })

    it('should fall back on unknown resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanTextToVideoApi', [
        { name: 'duration', value: '10' },
        { name: 'size', value: '2K' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.05, 0.15, { suffix: '/second' }))
    })
  })

  describe('dynamic pricing - WanImageToVideoApi', () => {
    it('should return $0.80 for 8s at 720p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanImageToVideoApi', [
        { name: 'duration', value: 8 },
        { name: 'resolution', value: '720p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.8)) // 0.10 * 8
    })

    it('should return $0.60 for 12s at 480P', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanImageToVideoApi', [
        { name: 'duration', value: '12' },
        { name: 'resolution', value: '480P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.6)) // 0.05 * 12
    })

    it('should return $1.50 for 10s at 1080p', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanImageToVideoApi', [
        { name: 'duration', value: '10' },
        { name: 'resolution', value: '1080p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.5)) // 0.15 * 10
    })

    it('should handle "5s" string duration at 1080P', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanImageToVideoApi', [
        { name: 'duration', value: '5s' },
        { name: 'resolution', value: '1080P' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.75)) // 0.15 * 5
    })

    it('should fall back when widgets are missing', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const missingBoth = createMockNode('WanImageToVideoApi', [])
      const missingRes = createMockNode('WanImageToVideoApi', [
        { name: 'duration', value: '5' }
      ])
      const missingDuration = createMockNode('WanImageToVideoApi', [
        { name: 'resolution', value: '1080p' }
      ])

      expect(getNodeDisplayPrice(missingBoth)).toBe(
        creditsRangeLabel(0.05, 0.15, { suffix: '/second' })
      )
      expect(getNodeDisplayPrice(missingRes)).toBe(
        creditsRangeLabel(0.05, 0.15, { suffix: '/second' })
      )
      expect(getNodeDisplayPrice(missingDuration)).toBe(
        creditsRangeLabel(0.05, 0.15, { suffix: '/second' })
      )
    })

    it('should fall back on invalid duration', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanImageToVideoApi', [
        { name: 'duration', value: 'invalid' },
        { name: 'resolution', value: '720p' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.05, 0.15, { suffix: '/second' }))
    })

    it('should fall back on unknown resolution', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('WanImageToVideoApi', [
        { name: 'duration', value: '10' },
        { name: 'resolution', value: 'weird-res' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.05, 0.15, { suffix: '/second' }))
    })
  })

  describe('dynamic pricing - LtxvApiTextToVideo', () => {
    it('should return $0.30 for Pro 1080p 5s', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LtxvApiTextToVideo', [
        { name: 'model', value: 'LTX-2 (Pro)' },
        { name: 'duration', value: '5' },
        { name: 'resolution', value: '1920x1080' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.3)) // 0.06 * 5
    })

    it('should parse "10s" duration strings', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LtxvApiTextToVideo', [
        { name: 'model', value: 'LTX-2 (Fast)' },
        { name: 'duration', value: '10' },
        { name: 'resolution', value: '3840x2160' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.6)) // 0.16 * 10
    })

    it('should fall back when a required widget is missing (no resolution)', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LtxvApiTextToVideo', [
        { name: 'model', value: 'LTX-2 (Pro)' },
        { name: 'duration', value: '5' }
        // missing resolution
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.04, 0.24, { suffix: '/second' }))
    })

    it('should fall back for unknown model', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNode('LtxvApiTextToVideo', [
        { name: 'model', value: 'LTX-3 (Pro)' },
        { name: 'duration', value: 5 },
        { name: 'resolution', value: '1920x1080' }
      ])

      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsRangeLabel(0.04, 0.24, { suffix: '/second' }))
    })
  })
})
const CREDIT_NUMBER_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}

type CreditFormatOptions = {
  suffix?: string
  note?: string
  approximate?: boolean
}

const creditValue = (usd: number): string =>
  formatCreditsFromUsd({
    usd,
    numberOptions: CREDIT_NUMBER_OPTIONS
  })

const prefix = (approximate?: boolean) => (approximate ? '~' : '')
const suffix = (value?: string) => value ?? '/Run'
const note = (value?: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  const hasParens = trimmed.startsWith('(') && trimmed.endsWith(')')
  const content = hasParens ? trimmed : `(${trimmed})`
  return ` ${content}`
}

const creditsLabel = (
  usd: number,
  {
    suffix: suffixOverride,
    note: noteOverride,
    approximate
  }: CreditFormatOptions = {}
): string =>
  `${prefix(approximate)}${creditValue(usd)} credits${suffix(suffixOverride)}${note(noteOverride)}`

const creditsRangeLabel = (
  minUsd: number,
  maxUsd: number,
  options?: CreditFormatOptions
): string => {
  const min = creditValue(minUsd)
  const max = creditValue(maxUsd)
  const value = min === max ? min : `${min}-${max}`
  return `${prefix(options?.approximate)}${value} credits${suffix(options?.suffix)}${note(options?.note)}`
}

const creditsListLabel = (
  usdValues: number[],
  options?: CreditFormatOptions & { separator?: string }
): string => {
  const parts = usdValues.map((value) => creditValue(value))
  const value = parts.join(options?.separator ?? '/')
  return `${prefix(options?.approximate)}${value} credits${suffix(options?.suffix)}${note(options?.note)}`
}
