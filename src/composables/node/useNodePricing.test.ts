import { describe, expect, it } from 'vitest'

import { formatCreditsFromUsd } from '@/base/credits/comfyCredits'
import { useNodePricing } from '@/composables/node/useNodePricing'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { PriceBadge } from '@/schemas/nodeDefSchema'

// -----------------------------------------------------------------------------
// Test Helpers
// -----------------------------------------------------------------------------

const CREDIT_NUMBER_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}

const creditValue = (usd: number): string =>
  formatCreditsFromUsd({ usd, numberOptions: CREDIT_NUMBER_OPTIONS })

const creditsLabel = (usd: number, suffix = '/Run'): string =>
  `${creditValue(usd)} credits${suffix}`

/**
 * Create a mock node with price_badge for testing JSONata-based pricing.
 */
function createMockNodeWithPriceBadge(
  nodeTypeName: string,
  priceBadge: PriceBadge,
  widgets: Array<{ name: string; value: unknown }> = [],
  inputs: Array<{ name: string; connected?: boolean }> = []
): LGraphNode {
  const mockWidgets = widgets.map(({ name, value }) => ({
    name,
    value,
    type: 'combo'
  }))

  const mockInputs = inputs.map(({ name, connected }) => ({
    name,
    link: connected ? 1 : null
  }))

  const node: any = {
    id: Math.random().toString(),
    widgets: mockWidgets,
    inputs: mockInputs,
    constructor: {
      nodeData: {
        name: nodeTypeName,
        api_node: true,
        price_badge: priceBadge
      }
    }
  }

  return node as LGraphNode
}

/** Helper to create a price badge with defaults */
const priceBadge = (
  expr: string,
  widgets: Array<{ name: string; type: string }> = [],
  inputs: string[] = [],
  inputGroups: string[] = []
): PriceBadge => ({
  engine: 'jsonata',
  expr,
  depends_on: { widgets, inputs, input_groups: inputGroups }
})

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useNodePricing', () => {
  describe('static expressions', () => {
    it('should evaluate simple static USD price', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestStaticNode',
        priceBadge('{"type":"usd","usd":0.05}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05))
    })

    it('should evaluate static text result', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestTextNode',
        priceBadge('{"type":"text","text":"Free"}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('Free')
    })
  })

  describe('widget value normalization', () => {
    it('should handle INT widget as number', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestIntNode',
        priceBadge('{"type":"usd","usd": widgets.count * 0.01}', [
          { name: 'count', type: 'INT' }
        ]),
        [{ name: 'count', value: 5 }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05))
    })

    it('should handle FLOAT widget as number', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestFloatNode',
        priceBadge('{"type":"usd","usd": widgets.rate * 10}', [
          { name: 'rate', type: 'FLOAT' }
        ]),
        [{ name: 'rate', value: 0.05 }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.5))
    })

    it('should handle COMBO widget with numeric value', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestComboNumericNode',
        priceBadge('{"type":"usd","usd": widgets.duration * 0.07}', [
          { name: 'duration', type: 'COMBO' }
        ]),
        [{ name: 'duration', value: 5 }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.35))
    })

    it('should handle COMBO widget with string value', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestComboStringNode',
        priceBadge(
          '(widgets.mode = "pro") ? {"type":"usd","usd":0.10} : {"type":"usd","usd":0.05}',
          [{ name: 'mode', type: 'COMBO' }]
        ),
        [{ name: 'mode', value: 'Pro' }] // Should be lowercased to "pro"
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.1))
    })

    it('should handle BOOLEAN widget', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestBooleanNode',
        priceBadge('{"type":"usd","usd": widgets.premium ? 0.10 : 0.05}', [
          { name: 'premium', type: 'BOOLEAN' }
        ]),
        [{ name: 'premium', value: true }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.1))
    })

    it('should handle STRING widget (lowercased)', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestStringNode',
        priceBadge(
          '$contains(widgets.model, "pro") ? {"type":"usd","usd":0.10} : {"type":"usd","usd":0.05}',
          [{ name: 'model', type: 'STRING' }]
        ),
        [{ name: 'model', value: 'ProModel' }] // Should be lowercased to "promodel"
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.1))
    })
  })

  describe('complex expressions', () => {
    it('should handle lookup tables', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestLookupNode',
        priceBadge(
          `(
            $rates := {"720p": 0.05, "1080p": 0.10};
            {"type":"usd","usd": $lookup($rates, widgets.resolution)}
          )`,
          [{ name: 'resolution', type: 'COMBO' }]
        ),
        [{ name: 'resolution', value: '1080p' }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.1))
    })

    it('should handle multiple widgets', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestMultiWidgetNode',
        priceBadge(
          `(
            $rate := (widgets.mode = "pro") ? 0.10 : 0.05;
            {"type":"usd","usd": $rate * widgets.duration}
          )`,
          [
            { name: 'mode', type: 'COMBO' },
            { name: 'duration', type: 'INT' }
          ]
        ),
        [
          { name: 'mode', value: 'pro' },
          { name: 'duration', value: 10 }
        ]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(1.0))
    })

    it('should handle conditional pricing based on widget values', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestConditionalNode',
        priceBadge(
          `(
            $mode := (widgets.resolution = "720p") ? "std" : "pro";
            $rates := {"std": 0.084, "pro": 0.112};
            {"type":"usd","usd": $lookup($rates, $mode) * widgets.duration}
          )`,
          [
            { name: 'resolution', type: 'COMBO' },
            { name: 'duration', type: 'COMBO' }
          ]
        ),
        [
          { name: 'resolution', value: '1080p' },
          { name: 'duration', value: 5 }
        ]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.56))
    })
  })

  describe('range and list results', () => {
    it('should format range_usd result', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestRangeNode',
        priceBadge('{"type":"range_usd","min_usd":0.05,"max_usd":0.10}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toMatch(/\d+-\d+ credits\/Run/)
    })

    it('should format list_usd result', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestListNode',
        priceBadge('{"type":"list_usd","usd":[0.05, 0.10, 0.15]}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toMatch(/\d+\/\d+\/\d+ credits\/Run/)
    })

    it('should respect custom suffix in format options', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestSuffixNode',
        priceBadge('{"type":"usd","usd":0.07,"format":{"suffix":"/second"}}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.07, '/second'))
    })

    it('should add approximate prefix when specified', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestApproximateNode',
        priceBadge('{"type":"usd","usd":0.05,"format":{"approximate":true}}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toMatch(/^~\d+ credits\/Run$/)
    })

    it('should add note suffix when specified', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestNoteNode',
        priceBadge('{"type":"usd","usd":0.05,"format":{"note":"(estimated)"}}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toMatch(/credits\/Run \(estimated\)$/)
    })

    it('should combine approximate prefix and note suffix', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestCombinedFormatNode',
        priceBadge(
          '{"type":"usd","usd":0.05,"format":{"approximate":true,"note":"(beta)","suffix":"/image"}}'
        )
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toMatch(/^~\d+ credits\/image \(beta\)$/)
    })

    it('should use custom separator for list_usd', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestListSeparatorNode',
        priceBadge(
          '{"type":"list_usd","usd":[0.05, 0.10],"format":{"separator":" or "}}'
        )
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toMatch(/\d+ or \d+ credits\/Run/)
    })
  })

  describe('input connectivity', () => {
    it('should handle connected input check', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestInputNode',
        priceBadge(
          'inputs.image.connected ? {"type":"usd","usd":0.10} : {"type":"usd","usd":0.05}',
          [],
          ['image']
        ),
        [],
        [{ name: 'image', connected: true }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.1))
    })

    it('should handle disconnected input check', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestInputDisconnectedNode',
        priceBadge(
          'inputs.image.connected ? {"type":"usd","usd":0.10} : {"type":"usd","usd":0.05}',
          [],
          ['image']
        ),
        [],
        [{ name: 'image', connected: false }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05))
    })
  })

  describe('edge cases', () => {
    it('should return empty string for non-API nodes', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node: any = {
        id: 'test',
        widgets: [],
        constructor: {
          nodeData: {
            name: 'RegularNode',
            api_node: false
          }
        }
      }

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })

    it('should return empty string for nodes without price_badge', () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node: any = {
        id: 'test',
        widgets: [],
        constructor: {
          nodeData: {
            name: 'ApiNodeNoPricing',
            api_node: true
          }
        }
      }

      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })

    it('should handle null widget value gracefully', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestNullWidgetNode',
        priceBadge(
          '{"type":"usd","usd": (widgets.count != null) ? widgets.count * 0.01 : 0.05}',
          [{ name: 'count', type: 'INT' }]
        ),
        [{ name: 'count', value: null }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05))
    })

    it('should handle missing widget gracefully', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestMissingWidgetNode',
        priceBadge(
          '{"type":"usd","usd": (widgets.count != null) ? widgets.count * 0.01 : 0.05}',
          [{ name: 'count', type: 'INT' }]
        ),
        []
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05))
    })

    it('should handle undefined widget value gracefully', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestUndefinedWidgetNode',
        priceBadge(
          '{"type":"usd","usd": (widgets.count != null) ? widgets.count * 0.01 : 0.05}',
          [{ name: 'count', type: 'INT' }]
        ),
        [{ name: 'count', value: undefined }]
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe(creditsLabel(0.05))
    })
  })

  describe('getNodePricingConfig', () => {
    it('should return pricing config for nodes with price_badge', () => {
      const { getNodePricingConfig } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestConfigNode',
        priceBadge('{"type":"usd","usd":0.05}')
      )

      const config = getNodePricingConfig(node)
      expect(config).toBeDefined()
      expect(config?.engine).toBe('jsonata')
      expect(config?.expr).toBe('{"type":"usd","usd":0.05}')
      expect(config?.depends_on).toBeDefined()
    })

    it('should return undefined for nodes without price_badge', () => {
      const { getNodePricingConfig } = useNodePricing()
      const node: any = {
        id: 'test',
        widgets: [],
        constructor: {
          nodeData: {
            name: 'NoPricingNode',
            api_node: true
          }
        }
      }

      const config = getNodePricingConfig(node)
      expect(config).toBeUndefined()
    })

    it('should return undefined for non-API nodes', () => {
      const { getNodePricingConfig } = useNodePricing()
      const node: any = {
        id: 'test',
        widgets: [],
        constructor: {
          nodeData: {
            name: 'RegularNode',
            api_node: false
          }
        }
      }

      const config = getNodePricingConfig(node)
      expect(config).toBeUndefined()
    })
  })

  describe('getNodeRevisionRef', () => {
    it('should return a ref for a node ID', () => {
      const { getNodeRevisionRef } = useNodePricing()
      const ref = getNodeRevisionRef('node-1')

      expect(ref).toBeDefined()
      expect(ref.value).toBe(0)
    })

    it('should return the same ref for the same node ID', () => {
      const { getNodeRevisionRef } = useNodePricing()
      const ref1 = getNodeRevisionRef('node-same')
      const ref2 = getNodeRevisionRef('node-same')

      expect(ref1).toBe(ref2)
    })

    it('should return different refs for different node IDs', () => {
      const { getNodeRevisionRef } = useNodePricing()
      const ref1 = getNodeRevisionRef('node-a')
      const ref2 = getNodeRevisionRef('node-b')

      expect(ref1).not.toBe(ref2)
    })

    it('should handle both string and number node IDs', () => {
      const { getNodeRevisionRef } = useNodePricing()
      // Number ID gets stringified, so '123' and 123 should return the same ref
      const refFromNumber = getNodeRevisionRef(123)
      const refFromString = getNodeRevisionRef('123')

      expect(refFromNumber).toBe(refFromString)
    })
  })

  describe('triggerPriceRecalculation', () => {
    it('should not throw for API nodes with price_badge', () => {
      const { triggerPriceRecalculation } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestTriggerNode',
        priceBadge('{"type":"usd","usd":0.05}')
      )

      expect(() => triggerPriceRecalculation(node)).not.toThrow()
    })

    it('should not throw for non-API nodes', () => {
      const { triggerPriceRecalculation } = useNodePricing()
      const node: any = {
        id: 'test',
        widgets: [],
        constructor: {
          nodeData: {
            name: 'RegularNode',
            api_node: false
          }
        }
      }

      expect(() => triggerPriceRecalculation(node)).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('should return empty string for invalid JSONata expression', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestInvalidExprNode',
        // Invalid JSONata syntax (unclosed parenthesis)
        priceBadge('{"type":"usd","usd": (widgets.count * 0.01')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      // Should not crash, just return empty
      expect(price).toBe('')
    })

    it('should return empty string for expression that throws at runtime', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestRuntimeErrorNode',
        // Expression that will fail at runtime (calling function on undefined)
        priceBadge('$lookup(undefined, "key")')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })

    it('should return empty string for invalid PricingResult type', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestInvalidResultTypeNode',
        // Returns object with invalid type field
        priceBadge('{"type":"invalid_type","value":123}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })

    it('should return empty string for PricingResult missing type field', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestMissingTypeNode',
        // Returns object without type field
        priceBadge('{"usd":0.05}')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })

    it('should return empty string for non-object result', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestNonObjectNode',
        // Returns a plain number instead of PricingResult object
        priceBadge('0.05')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })

    it('should return empty string for null result', async () => {
      const { getNodeDisplayPrice } = useNodePricing()
      const node = createMockNodeWithPriceBadge(
        'TestNullResultNode',
        priceBadge('null')
      )

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      expect(price).toBe('')
    })
  })

  describe('input_groups connectivity', () => {
    it('should count connected inputs in a group', async () => {
      const { getNodeDisplayPrice } = useNodePricing()

      // Create a node with autogrow-style inputs (group.input1, group.input2, etc.)
      const node: any = {
        id: Math.random().toString(),
        widgets: [],
        inputs: [
          { name: 'videos.clip1', link: 1 }, // connected
          { name: 'videos.clip2', link: 2 }, // connected
          { name: 'videos.clip3', link: null }, // disconnected
          { name: 'other_input', link: 3 } // connected but not in group
        ],
        constructor: {
          nodeData: {
            name: 'TestInputGroupNode',
            api_node: true,
            price_badge: {
              engine: 'jsonata',
              expr: '{"type":"usd","usd": inputGroups.videos * 0.05}',
              depends_on: {
                widgets: [],
                inputs: [],
                input_groups: ['videos']
              }
            }
          }
        }
      }

      getNodeDisplayPrice(node)
      await new Promise((r) => setTimeout(r, 50))
      const price = getNodeDisplayPrice(node)
      // 2 connected inputs in 'videos' group * 0.05 = 0.10
      expect(price).toBe(creditsLabel(0.1))
    })
  })
})
