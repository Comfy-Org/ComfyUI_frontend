import { zComfyNodeDef, zPriceBadge } from '@comfyorg/object-info-parser'
import { describe, expect, it } from 'vitest'

import { CREDITS_PER_USD } from './creditsUtil'
import {
  classifyPricingResult,
  estimateApiNodeRunCost,
  evaluateNodeDefPricing,
  evaluatePricingBasis,
  evaluatePricingContext,
  formatPricingResult,
  getCompiledRuleForNodeType
} from './nodePricing'
import type { ApiNodeCostEntry } from './nodePricing'

const context = { widgets: {}, inputs: {}, inputGroups: {} }

describe('evaluatePricingContext', () => {
  it('recompiles a changed rule under the same node name', async () => {
    const badge = zPriceBadge.parse({ expr: '{"type":"usd","usd":0.05}' })
    expect(await evaluatePricingContext('RefreshedRule', badge, context)).toBe(
      '10.6 credits/Run'
    )
    badge.expr = '{"type":"usd","usd":0.10}'
    expect(await evaluatePricingContext('RefreshedRule', badge, context)).toBe(
      '21.1 credits/Run'
    )
  })

  it('refreshes dependency metadata even when the expression is unchanged', () => {
    const badge = zPriceBadge.parse({ expr: '{"type":"usd","usd":0.05}' })
    const original = getCompiledRuleForNodeType('RefreshedDependencies', badge)
    const changed = getCompiledRuleForNodeType('RefreshedDependencies', {
      ...badge,
      depends_on: { ...badge.depends_on, inputs: ['image'] }
    })
    expect(changed).not.toBe(original)
    expect(changed?.depends_on.inputs).toEqual(['image'])
  })

  it('honors the list separator in both value-only and complete labels', () => {
    const result = {
      type: 'list_usd',
      usd: [0.05, 0.1],
      format: { separator: ' or ', approximate: true }
    }
    expect(formatPricingResult(result, { valueOnly: true })).toBe(
      '~10.6 or 21.1'
    )
    expect(formatPricingResult(result)).toBe('~10.6 or 21.1 credits/Run')
  })
  it('keeps a range and its per-second unit instead of presenting a run total', async () => {
    const badge = zPriceBadge.parse({
      expr: '{"type":"range_usd","min_usd":0.05,"max_usd":0.10,"format":{"suffix":"/sec","approximate":true}}'
    })
    expect(
      await evaluatePricingContext('VideoRange', badge, {
        widgets: {},
        inputs: {},
        inputGroups: {}
      })
    ).toBe('~10.6-21.1 credits/sec')
  })

  it('reevaluates the same compiled rule for different model settings and media inputs', async () => {
    const badge = zPriceBadge.parse({
      expr: '{"type":"usd","usd":widgets.duration * 0.05 + (inputs.image.connected ? 0.01 : 0)}',
      depends_on: {
        widgets: [{ name: 'duration', type: 'INT' }],
        inputs: ['image']
      }
    })
    expect(
      await evaluatePricingContext('VideoSettings', badge, {
        widgets: { duration: 1 },
        inputs: { image: { connected: false } },
        inputGroups: {}
      })
    ).toBe('10.6 credits/Run')
    expect(
      await evaluatePricingContext('VideoSettings', badge, {
        widgets: { duration: 6 },
        inputs: { image: { connected: true } },
        inputGroups: {}
      })
    ).toBe('65.4 credits/Run')
  })

  it.for(['(', '$error("unavailable")', '{"type":"unexpected","usd":10}'])(
    'does not display a fabricated price for an invalid rule: %s',
    async (expr) => {
      expect(
        await evaluatePricingContext(
          `Invalid:${expr}`,
          zPriceBadge.parse({ expr }),
          {
            widgets: {},
            inputs: {},
            inputGroups: {}
          }
        )
      ).toBe('')
    }
  )
})

describe('default node pricing', () => {
  function nodeDefinition() {
    return zComfyNodeDef.parse({
      name: 'ReloadedDefaults',
      display_name: 'Reloaded defaults',
      description: '',
      category: 'test',
      output_node: false,
      python_module: 'test',
      input: { required: { count: ['INT', { default: 1 }] } },
      price_badge: {
        expr: '{"type":"usd","usd":widgets.count * 0.05}',
        depends_on: { widgets: [{ name: 'count', type: 'INT' }] }
      }
    })
  }

  it('recalculates after a default or rule changes on the same definition', async () => {
    const node = nodeDefinition()
    expect(await evaluateNodeDefPricing(node)).toBe('10.6')
    node.input = { required: { count: ['INT', { default: 2 }] } }
    expect(await evaluateNodeDefPricing(node)).toBe('21.1')
    node.price_badge = zPriceBadge.parse({ expr: '{"type":"usd","usd":0.20}' })
    expect(await evaluateNodeDefPricing(node)).toBe('42.2')
  })

  it.for(['COMBO', 'INT', 'FLOAT', 'BOOLEAN'])(
    'withholds estimates when a %s dependency has no usable default',
    async (type) => {
      const node = nodeDefinition()
      node.input = { required: {} }
      node.price_badge = zPriceBadge.parse({
        expr: '{"type":"usd","usd":widgets.resolution = "original" ? 0.05 : 0.10}',
        depends_on: { widgets: [{ name: 'resolution', type }] }
      })
      expect(await evaluateNodeDefPricing(node)).toBe('')
    }
  )
})

describe('classifyPricingResult', () => {
  it('reads an unsuffixed figure as the per-run charge it defaults to', () => {
    expect(classifyPricingResult({ type: 'usd', usd: 0.05 })).toEqual({
      basis: 'per-run',
      minUsd: 0.05,
      maxUsd: 0.05,
      approximate: false
    })
  })

  it('reads the legacy bare-usd shape as per-run too', () => {
    expect(classifyPricingResult({ usd: 0.05 })).toEqual({
      basis: 'per-run',
      minUsd: 0.05,
      maxUsd: 0.05,
      approximate: false
    })
  })

  it.for(['/Run', '/run', ' /Run ', 'Run'])(
    'accepts %o as the per-run suffix',
    (suffix) => {
      expect(
        classifyPricingResult({ type: 'usd', usd: 0.05, format: { suffix } })
      ).toMatchObject({ basis: 'per-run' })
    }
  )

  it('does not accept a suffix that merely ends in /Run', () => {
    expect(
      classifyPricingResult({
        type: 'usd',
        usd: 0.04,
        format: { suffix: ' x images/Run' }
      })
    ).toEqual({
      basis: 'per-unit',
      unit: 'x images/Run',
      minUsd: 0.04,
      maxUsd: 0.04,
      approximate: false
    })
  })

  it.for([
    [' per 1K tokens', 'per 1K tokens'],
    ['/second', 'second'],
    ['/minute', 'minute'],
    ['/Image', 'Image'],
    ['/30 frames', '30 frames'],
    ['/8MP', '8MP']
  ])('reports %o as priced per %o rather than per run', ([suffix, unit]) => {
    expect(
      classifyPricingResult({
        type: 'usd',
        usd: 0.1,
        format: { suffix, approximate: true }
      })
    ).toEqual({
      basis: 'per-unit',
      unit,
      minUsd: 0.1,
      maxUsd: 0.1,
      approximate: true
    })
  })

  it.for(['(base)', '(input + output)', '(by source length)'])(
    'withholds a per-run total from a figure the note %o qualifies',
    (note) => {
      expect(
        classifyPricingResult({ type: 'usd', usd: 0.05, format: { note } })
      ).toEqual({ basis: 'unpriced', reason: 'ambiguous' })
    }
  )

  it.for([{ suffix: '' }, { suffix: '  ' }, { suffix: '/' }])(
    'reports the blank suffix in %o as ambiguous rather than an empty unit',
    (format) => {
      expect(classifyPricingResult({ type: 'usd', usd: 0.05, format })).toEqual(
        { basis: 'unpriced', reason: 'ambiguous' }
      )
    }
  )

  it('rejects a non-string suffix instead of throwing', () => {
    expect(
      classifyPricingResult({
        type: 'usd',
        usd: 0.05,
        format: { suffix: 1 }
      })
    ).toEqual({ basis: 'unpriced', reason: 'invalid' })
  })

  it.for([1, 'true', {}])(
    'treats the truthy approximate flag %o as approximate, matching the label',
    (approximate) => {
      expect(
        classifyPricingResult({
          type: 'usd',
          usd: 0.05,
          format: { approximate }
        })
      ).toMatchObject({ basis: 'per-run', approximate: true })
    }
  )

  it('carries a per-run range through as its two bounds', () => {
    expect(
      classifyPricingResult({ type: 'range_usd', min_usd: 0.05, max_usd: 0.2 })
    ).toEqual({
      basis: 'per-run',
      minUsd: 0.05,
      maxUsd: 0.2,
      approximate: false
    })
  })

  it('sorts an inverted range so the aggregate cannot invert', () => {
    expect(
      classifyPricingResult({ type: 'range_usd', min_usd: 0.2, max_usd: 0.05 })
    ).toMatchObject({ minUsd: 0.05, maxUsd: 0.2 })
  })

  it('refuses to guess what a multi-valued per-run list means', () => {
    expect(
      classifyPricingResult({ type: 'list_usd', usd: [0.05, 0.1] })
    ).toEqual({ basis: 'unpriced', reason: 'ambiguous' })
  })

  it('reads a single-valued list as that one per-run charge', () => {
    expect(classifyPricingResult({ type: 'list_usd', usd: [0.05] })).toEqual({
      basis: 'per-run',
      minUsd: 0.05,
      maxUsd: 0.05,
      approximate: false
    })
  })

  it('excludes a token-priced list by its unit, not as ambiguous', () => {
    expect(
      classifyPricingResult({
        type: 'list_usd',
        usd: [0.00125, 0.01],
        format: { suffix: ' per 1K tokens', separator: '-', approximate: true }
      })
    ).toEqual({
      basis: 'per-unit',
      unit: 'per 1K tokens',
      minUsd: 0.00125,
      maxUsd: 0.01,
      approximate: true
    })
  })

  it.for([Number.NaN, Number.POSITIVE_INFINITY, -0.05])(
    'rejects a whole list when one entry is %o, rather than pricing the rest',
    (bad) => {
      expect(
        classifyPricingResult({ type: 'list_usd', usd: [0.05, bad] })
      ).toEqual({ basis: 'unpriced', reason: 'invalid' })
    }
  )

  it.for([
    { type: 'usd', usd: -0.05 },
    { type: 'range_usd', min_usd: -0.05, max_usd: 0.2 },
    { usd: -0.05 }
  ])('rejects the negative figure in %o', (result) => {
    expect(classifyPricingResult(result)).toEqual({
      basis: 'unpriced',
      reason: 'invalid'
    })
  })

  it.for(['Token-based', 'Free', 'Interpolation only'])(
    'treats the prose result %o as unpriced rather than as zero',
    (text) => {
      expect(classifyPricingResult({ type: 'text', text })).toEqual({
        basis: 'unpriced',
        reason: 'descriptive'
      })
    }
  )

  it.for([
    undefined,
    null,
    '',
    42,
    {},
    { type: 'usd' },
    { type: 'usd', usd: Number.NaN },
    { type: 'usd', usd: Number.POSITIVE_INFINITY },
    { type: 'range_usd', min_usd: 0.05 },
    { type: 'list_usd', usd: [] },
    { type: 'something_else', usd: 0.05 }
  ])('reports %o as invalid rather than free', (result) => {
    expect(classifyPricingResult(result)).toEqual({
      basis: 'unpriced',
      reason: 'invalid'
    })
  })
})

describe('estimateApiNodeRunCost', () => {
  const perRun = (nodeType: string, minUsd: number, maxUsd = minUsd) =>
    ({
      nodeType,
      price: { basis: 'per-run', minUsd, maxUsd, approximate: false }
    }) satisfies ApiNodeCostEntry

  it('sums per-run bounds and reports complete coverage', () => {
    const estimate = estimateApiNodeRunCost([
      perRun('A', 0.05),
      perRun('B', 0.1, 0.3)
    ])
    expect(estimate.minUsd).toBeCloseTo(0.15, 10)
    expect(estimate.maxUsd).toBeCloseTo(0.35, 10)
    expect(estimate).toMatchObject({
      pricedCount: 2,
      coverage: 'complete',
      isLowerBound: false,
      approximate: false,
      perUnit: [],
      unpriced: []
    })
  })

  it('converts the summed dollars once, without rounding per node', () => {
    const sumOfRenderedLabels = 31.8
    const estimate = estimateApiNodeRunCost([
      perRun('A', 0.05),
      perRun('A', 0.05),
      perRun('A', 0.05)
    ])
    expect(estimate.minCredits).toBeCloseTo(0.15 * CREDITS_PER_USD, 10)
    expect(estimate.minCredits).not.toBeCloseTo(sumOfRenderedLabels, 2)
  })

  it('declares a lower bound and names what it left out', () => {
    const tokenPriced: ApiNodeCostEntry = {
      nodeType: 'GeminiNode',
      nodeId: 7,
      price: {
        basis: 'per-unit',
        unit: 'per 1K tokens',
        minUsd: 0.00125,
        maxUsd: 0.01,
        approximate: true
      }
    }
    const prose: ApiNodeCostEntry = {
      nodeType: 'TripoNode',
      price: { basis: 'unpriced', reason: 'descriptive' }
    }
    const estimate = estimateApiNodeRunCost([
      perRun('A', 0.05),
      tokenPriced,
      prose
    ])
    expect(estimate).toMatchObject({
      pricedCount: 1,
      coverage: 'partial',
      isLowerBound: true,
      perUnit: [tokenPriced],
      unpriced: [prose]
    })
    expect(estimate.minUsd).toBeCloseTo(0.05, 10)
    expect(estimate.maxUsd).toBeCloseTo(0.05, 10)
  })

  it('reports none, not a zero estimate, when nothing could be priced', () => {
    const estimate = estimateApiNodeRunCost([
      { nodeType: 'A', price: { basis: 'unpriced', reason: 'invalid' } }
    ])
    expect(estimate).toMatchObject({
      coverage: 'none',
      isLowerBound: true,
      pricedCount: 0,
      minUsd: 0,
      maxUsd: 0
    })
  })

  it('reports complete coverage of nothing for an empty graph', () => {
    expect(estimateApiNodeRunCost([])).toMatchObject({
      coverage: 'complete',
      isLowerBound: false,
      pricedCount: 0,
      minUsd: 0,
      maxUsd: 0
    })
  })

  it('marks the whole estimate approximate when any term is', () => {
    expect(
      estimateApiNodeRunCost([
        perRun('A', 0.05),
        {
          nodeType: 'B',
          price: {
            basis: 'per-run',
            minUsd: 0.1,
            maxUsd: 0.1,
            approximate: true
          }
        }
      ])
    ).toMatchObject({ approximate: true, coverage: 'complete' })
  })

  it.for([
    [Number.NaN, Number.NaN],
    [-0.05, 0.05],
    [0.3, 0.1]
  ])('excludes a hand-built entry whose bounds are %o..%o', ([min, max]) => {
    const estimate = estimateApiNodeRunCost([
      perRun('A', 0.05),
      {
        nodeType: 'B',
        price: {
          basis: 'per-run',
          minUsd: min,
          maxUsd: max,
          approximate: false
        }
      }
    ])
    expect(estimate.minUsd).toBeCloseTo(0.05, 10)
    expect(estimate).toMatchObject({
      pricedCount: 1,
      coverage: 'partial',
      isLowerBound: true
    })
  })

  it.for([
    { stage: 'the USD sum', price: Number.MAX_VALUE },
    { stage: 'credit conversion', price: Number.MAX_VALUE / CREDITS_PER_USD }
  ])('degrades to none when $stage overflows', ({ price }) => {
    const estimate = estimateApiNodeRunCost([
      perRun('A', price),
      perRun('B', price)
    ])
    expect(estimate).toMatchObject({
      coverage: 'none',
      isLowerBound: true,
      pricedCount: 0,
      minUsd: 0,
      maxUsd: 0,
      minCredits: 0,
      maxCredits: 0
    })
    expect(estimate.unpriced).toHaveLength(2)
  })
})

describe('evaluatePricingBasis', () => {
  it('prices a node from its badge and current widget state', async () => {
    const badge = zPriceBadge.parse({
      expr: '{"type":"usd","usd":widgets.count * 0.05}',
      depends_on: { widgets: [{ name: 'count', type: 'INT' }] }
    })
    const price = await evaluatePricingBasis('BasisNode', badge, {
      widgets: { count: 3 },
      inputs: {},
      inputGroups: {}
    })
    expect(price).toMatchObject({ basis: 'per-run' })
    expect(price).toHaveProperty('minUsd', expect.closeTo(0.15, 10))
    expect(price).toHaveProperty('maxUsd', expect.closeTo(0.15, 10))
  })

  it('reports an absent badge as unpriced rather than free', async () => {
    expect(
      await evaluatePricingBasis('UnreadableNode', undefined, context)
    ).toEqual({ basis: 'unpriced', reason: 'invalid' })
  })

  it.for(['{"type":"usd","usd":', '$notAFunction()'])(
    'reports the unusable expression %o as unpriced rather than free',
    async (expr) => {
      expect(
        await evaluatePricingBasis(
          `Unreadable:${expr}`,
          zPriceBadge.parse({ expr }),
          context
        )
      ).toEqual({ basis: 'unpriced', reason: 'invalid' })
    }
  )
})
