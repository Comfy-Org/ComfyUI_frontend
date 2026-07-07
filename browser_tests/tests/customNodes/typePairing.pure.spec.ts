import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import {
  isTypeCompatible,
  normalizeNodeDefs,
  packOf,
  planPairs
} from '@e2e/fixtures/customNode/typePairing'

const DEFS: Record<string, RawNodeDef> = {
  LatentSource: {
    input: { required: {} },
    output: ['LATENT'],
    output_name: ['LATENT'],
    python_module: 'nodes'
  },
  LatentSink: {
    input: { required: { latent: ['LATENT', {}] } },
    output: [],
    python_module: 'custom_nodes.SomePack'
  },
  UnionSource: {
    input: { required: {} },
    output: ['STRING,INT'],
    output_name: ['value'],
    python_module: 'nodes'
  },
  IntSink: {
    input: { required: { value: ['int', {}] } },
    output: [],
    python_module: 'nodes'
  },
  ComboNode: {
    input: { required: { choice: [['a', 'b'], {}] } },
    output: [],
    python_module: 'nodes'
  },
  SocketlessNode: {
    input: { required: { hidden: ['STRING', { socketless: true }] } },
    output: [],
    python_module: 'nodes'
  },
  WildcardNode: {
    input: { required: { anything: ['*', {}] } },
    output: ['*'],
    output_name: ['out'],
    python_module: 'nodes'
  },
  OrphanNode: {
    input: { required: {} },
    output: ['NOBODY_CONSUMES_THIS'],
    output_name: ['orphan'],
    python_module: 'custom_nodes.OrphanPack'
  }
}

test.describe('typePairing', () => {
  test('isTypeCompatible mirrors the real validator semantics', () => {
    expect(isTypeCompatible('LATENT', 'LATENT')).toBe(true)
    expect(isTypeCompatible('latent', 'LATENT')).toBe(true)
    expect(isTypeCompatible('LATENT', 'IMAGE')).toBe(false)
    expect(isTypeCompatible('STRING,INT', 'INT')).toBe(true)
    expect(isTypeCompatible('STRING,INT', 'FLOAT')).toBe(false)
    expect(isTypeCompatible('*', 'ANYTHING')).toBe(true)
    expect(isTypeCompatible('', 'ANYTHING')).toBe(true)
  })

  test('packOf attributes core vs custom pack', () => {
    expect(packOf('nodes')).toBe('core')
    expect(packOf('comfy_extras.nodes_x')).toBe('core')
    expect(packOf('custom_nodes.ComfyUI-Impact-Pack')).toBe(
      'ComfyUI-Impact-Pack'
    )
    expect(packOf(undefined)).toBe('core')
  })

  test('normalize maps COMBO literals and drops socketless inputs', () => {
    const nodes = normalizeNodeDefs(DEFS)
    const combo = nodes.find((n) => n.type === 'ComboNode')!
    expect(combo.inputs).toEqual([
      { name: 'choice', type: 'COMBO', comboOptions: ['a', 'b'] }
    ])
    const socketless = nodes.find((n) => n.type === 'SocketlessNode')!
    expect(socketless.inputs).toEqual([])
  })

  test('planPairs pairs exact and union types, deterministically', () => {
    const nodes = normalizeNodeDefs(DEFS)
    const plan = planPairs(nodes, ['LatentSink', 'IntSink'])
    const keys = plan.pairs.map(
      (p) =>
        `${p.producer.nodeType}.${p.producer.slotName}->${p.consumer.nodeType}.${p.consumer.slotName}`
    )
    expect(keys).toContain('LatentSource.LATENT->LatentSink.latent')
    expect(keys).toContain('UnionSource.value->IntSink.value')
    const again = planPairs(nodes, ['LatentSink', 'IntSink'])
    expect(again.pairs).toEqual(plan.pairs)
  })

  test('COMBO slots with different vocabularies stay excluded', () => {
    const nodes = normalizeNodeDefs({
      ComboSource: {
        input: { required: {} },
        output: [['A', 'B', 'C']],
        output_name: [['A', 'B', 'C'] as unknown as string],
        python_module: 'nodes'
      },
      ...DEFS
    })
    const source = nodes.find((n) => n.type === 'ComboSource')!
    expect(source.outputs).toEqual([
      { name: 'COMBO', type: 'COMBO', comboOptions: ['A', 'B', 'C'] }
    ])
    // ComboNode.choice offers [a, b] - not the same vocabulary as [A, B, C].
    const plan = planPairs(nodes, ['ComboSource', 'ComboNode'])
    expect(plan.pairs).toEqual([])
    expect(plan.combos.map((s) => `${s.nodeType}.${s.slotName}`)).toEqual([
      'ComboSource.COMBO',
      'ComboNode.choice'
    ])
  })

  test('COMBO slots with an identical vocabulary pair up', () => {
    const nodes = normalizeNodeDefs({
      SamplerNameSource: {
        input: { required: {} },
        output: [['euler', 'ddim']],
        output_name: [['euler', 'ddim'] as unknown as string],
        python_module: 'nodes'
      },
      SamplerNameSink: {
        input: { required: { sampler_name: [['euler', 'ddim'], {}] } },
        output: [],
        python_module: 'nodes'
      },
      ...DEFS
    })
    const plan = planPairs(nodes, ['SamplerNameSource', 'SamplerNameSink'])
    expect(
      plan.pairs.map(
        (p) =>
          `${p.producer.nodeType}.${p.producer.slotName}->${p.consumer.nodeType}.${p.consumer.slotName}`
      )
    ).toEqual(['SamplerNameSource.COMBO->SamplerNameSink.sampler_name'])
    expect(plan.combos).toEqual([])
  })

  test('wildcard slots are excluded, orphan types recorded not failed', () => {
    const nodes = normalizeNodeDefs(DEFS)
    const plan = planPairs(nodes, ['WildcardNode', 'OrphanNode'])
    expect(plan.wildcards.map((w) => w.nodeType)).toEqual([
      'WildcardNode',
      'WildcardNode'
    ])
    expect(plan.orphans).toEqual([
      {
        nodeType: 'OrphanNode',
        pack: 'OrphanPack',
        slotName: 'orphan',
        slotType: 'NOBODY_CONSUMES_THIS',
        dir: 'out'
      }
    ])
    expect(plan.pairs).toEqual([])
  })
})
