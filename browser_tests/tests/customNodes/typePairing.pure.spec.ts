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
    expect(isTypeCompatible('BBOX,', 'BBOX')).toBe(true)
    expect(isTypeCompatible('BBOX,', 'IMAGE')).toBe(true)
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
    // socketless is a recognized shape deliberately left out of the matrix;
    // it must never be recorded as an unknown slot.
    expect(socketless.unknownSlots).toBeUndefined()
  })

  test('unrecognizable slot specs are recorded, never silently dropped', () => {
    // A numeric input type and a numeric output type have no connectable
    // socket type (slotTypeOf null): the slot leaves the corpus, but the
    // drop must surface on the node and in the plan.
    const nodes = normalizeNodeDefs({
      WeirdNode: {
        input: { required: { strange: [42, {}], ok: ['INT', {}] } },
        output: [7, 'INT'],
        python_module: 'custom_nodes.weird-pack'
      }
    })
    const weird = nodes.find((n) => n.type === 'WeirdNode')!
    expect(weird.unknownSlots).toEqual(['strange', 'output[0]'])
    expect(weird.inputs.map((s) => s.name)).toEqual(['ok'])
    const plan = planPairs(nodes, ['WeirdNode'])
    expect(plan.unknownShapes).toEqual([
      'WeirdNode.strange',
      'WeirdNode.output[0]'
    ])
  })

  test('a short output_name list uses the production output_<index> fallback', () => {
    const shortNodes = normalizeNodeDefs({
      ShortNames: {
        input: { required: {} },
        output: ['IMAGE', 'MASK', ['alpha', 'beta']],
        output_name: ['image'],
        python_module: 'custom_nodes.short-names'
      },
      MaskSink: {
        input: { required: { mask: ['MASK', {}] } },
        output: [],
        python_module: 'nodes'
      }
    })
    const short = shortNodes.find((node) => node.type === 'ShortNames')!
    expect(short.outputs).toEqual([
      { name: 'image', type: 'IMAGE' },
      { name: 'output_1', type: 'MASK' },
      {
        name: 'output_2',
        type: 'COMBO',
        comboOptions: ['alpha', 'beta']
      }
    ])
    expect(short.unknownSlots).toBeUndefined()
    expect(
      planPairs(shortNodes, ['ShortNames', 'MaskSink']).pairs.map(
        (pair) =>
          `${pair.producer.nodeType}.${pair.producer.slotName}->${pair.consumer.nodeType}.${pair.consumer.slotName}`
      )
    ).toContain('ShortNames.output_1->MaskSink.mask')

    const [unnamed] = normalizeNodeDefs({
      Unnamed: {
        input: { required: {} },
        output: ['IMAGE', 'MASK'],
        python_module: 'custom_nodes.unnamed'
      }
    })
    expect(unnamed.outputs).toEqual([
      { name: 'output_0', type: 'IMAGE' },
      { name: 'output_1', type: 'MASK' }
    ])

    const [falsyName] = normalizeNodeDefs({
      FalsyName: {
        input: { required: {} },
        output: ['IMAGE'],
        output_name: [null],
        python_module: 'custom_nodes.falsy-name'
      }
    })
    expect(falsyName.outputs).toEqual([{ name: 'output_0', type: 'IMAGE' }])

    const [emptyName] = normalizeNodeDefs({
      EmptyName: {
        input: { required: {} },
        output: ['IMAGE'],
        output_name: [''],
        python_module: 'custom_nodes.empty-name'
      }
    })
    expect(emptyName.outputs).toEqual([{ name: 'output_0', type: 'IMAGE' }])
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
    // The DEFS corpus is fully recognizable; unknownShapes stays empty.
    expect(plan.unknownShapes).toEqual([])
  })

  test('ledgered pairs are planned exactly in addition to representatives', () => {
    const nodes = normalizeNodeDefs({
      ImageSource: {
        input: { required: {} },
        output: ['IMAGE'],
        output_name: ['image'],
        python_module: 'custom_nodes.ExamplePack'
      },
      AlphaSink: {
        input: { required: { image: ['IMAGE', {}] } },
        output: [],
        python_module: 'nodes'
      },
      ExpectedSink: {
        input: { required: { image: ['IMAGE', {}] } },
        output: [],
        python_module: 'nodes'
      }
    })
    const plan = planPairs(
      nodes,
      ['ImageSource'],
      ['ImageSource.image -> ExpectedSink.image']
    )
    const keys = plan.pairs.map(
      (pair) =>
        `${pair.producer.nodeType}.${pair.producer.slotName} -> ${pair.consumer.nodeType}.${pair.consumer.slotName}`
    )

    expect(keys).toEqual([
      'ImageSource.image -> AlphaSink.image',
      'ImageSource.image -> ExpectedSink.image'
    ])
    expect(plan.requiredPairIssues).toEqual([])
  })

  test('ledgered pairs fail closed when a live slot contract changes', () => {
    const nodes = normalizeNodeDefs(DEFS)
    const plan = planPairs(
      nodes,
      ['LatentSink'],
      [
        'LatentSource.missing -> LatentSink.latent',
        'AbsentSource.output -> LatentSink.latent'
      ]
    )

    expect(plan.requiredPairIssues).toEqual([
      'LatentSource.missing -> LatentSink.latent: declared slot is no longer present',
      'AbsentSource.output -> LatentSink.latent: unknown node type(s): AbsentSource'
    ])
  })

  test('COMBO slots with different vocabularies stay excluded', () => {
    const nodes = normalizeNodeDefs({
      ComboSource: {
        input: { required: {} },
        output: [['A', 'B', 'C']],
        output_name: ['COMBO'],
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
        output_name: ['COMBO'],
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

  // Census-derived: transformed (V2-schema) defs carry combo inputs as the
  // string 'COMBO' with options in the opts object. Same vocabulary must
  // pair across forms, and a combo with no static options (remote/lazy)
  // must never blind-match.
  test('V2-form combos pair across forms by vocabulary; unknown options never pair', () => {
    const nodes = normalizeNodeDefs({
      ListFormSource: {
        input: { required: {} },
        output: [['x', 'y']],
        output_name: ['COMBO'],
        python_module: 'nodes'
      },
      V2FormSink: {
        input: {
          required: {
            dim: ['COMBO', { multiselect: false, options: ['y', 'x'] }]
          }
        },
        output: [],
        python_module: 'nodes'
      },
      RemoteComboSink: {
        input: {
          required: {
            image: ['COMBO', { remote: { route: '/internal/files/output' } }]
          }
        },
        output: [],
        python_module: 'nodes'
      },
      ...DEFS
    })
    const plan = planPairs(nodes, [
      'ListFormSource',
      'V2FormSink',
      'RemoteComboSink'
    ])
    expect(
      plan.pairs.map(
        (p) =>
          `${p.producer.nodeType}.${p.producer.slotName}->${p.consumer.nodeType}.${p.consumer.slotName}`
      )
    ).toEqual(['ListFormSource.COMBO->V2FormSink.dim'])
    expect(plan.combos.map((s) => `${s.nodeType}.${s.slotName}`)).toEqual([
      'RemoteComboSink.image'
    ])
  })

  test('COMBO vocabulary matching ignores option order', () => {
    // A wired input bypasses its own widget, so menu order and the
    // options[0] default are not part of the wire contract - membership is.
    const nodes = normalizeNodeDefs({
      ShuffledSource: {
        input: { required: {} },
        output: [['ddim', 'euler']],
        output_name: ['COMBO'],
        python_module: 'nodes'
      },
      SamplerNameSink: {
        input: { required: { sampler_name: [['euler', 'ddim'], {}] } },
        output: [],
        python_module: 'nodes'
      },
      ...DEFS
    })
    const plan = planPairs(nodes, ['ShuffledSource', 'SamplerNameSink'])
    expect(
      plan.pairs.map(
        (p) =>
          `${p.producer.nodeType}.${p.producer.slotName}->${p.consumer.nodeType}.${p.consumer.slotName}`
      )
    ).toEqual(['ShuffledSource.COMBO->SamplerNameSink.sampler_name'])
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

  test('an output whose output_name is not a string is recorded, never renamed', () => {
    const nodes = normalizeNodeDefs({
      TwoCombos: {
        input: { required: {} },
        output: [
          ['a', 'b'],
          ['x', 'y']
        ],
        output_name: [
          ['a', 'b'],
          ['x', 'y']
        ],
        python_module: 'custom_nodes.two-combos'
      },
      ComboSinkXY: {
        input: { required: { pick: [['x', 'y'], {}] } },
        output: [],
        python_module: 'nodes'
      }
    })
    const twoCombos = nodes.find((node) => node.type === 'TwoCombos')!
    expect(twoCombos.outputs).toEqual([])
    expect(twoCombos.unknownSlots).toEqual(['output[0].name', 'output[1].name'])
    const plan = planPairs(nodes, ['TwoCombos', 'ComboSinkXY'])
    expect(plan.pairs).toEqual([])
    expect(plan.unknownShapes).toEqual([
      'TwoCombos.output[0].name',
      'TwoCombos.output[1].name'
    ])
    expect(
      plan.combos.map((slot) => `${slot.nodeType}.${slot.slotName}`)
    ).toEqual(['ComboSinkXY.pick'])
  })
})
