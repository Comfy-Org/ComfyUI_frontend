import { describe, expect, it } from 'vitest'

import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import {
  isTypeCompatible,
  normalizeNodeDefs,
  packOf,
  planPairs
} from '@e2e/fixtures/customNode/typePairing'

function node(
  input: Record<string, unknown> = {},
  output: unknown[] = [],
  outputName?: unknown[],
  pythonModule = 'nodes'
): RawNodeDef {
  return {
    input: { required: input },
    output,
    ...(outputName === undefined ? {} : { output_name: outputName }),
    python_module: pythonModule
  }
}

const BASE_DEFS = {
  LatentSource: node({}, ['LATENT'], ['LATENT']),
  LatentSink: node({ latent: ['LATENT', {}] }),
  UnionSource: node({}, ['STRING,INT'], ['value']),
  IntSink: node({ value: ['int', {}] })
}

describe('isTypeCompatible', () => {
  const cases: Array<[string, string, boolean]> = [
    ['LATENT', 'LATENT', true],
    ['latent', 'LATENT', true],
    ['LATENT', 'IMAGE', false],
    ['STRING,INT', 'INT', true],
    ['STRING,INT', 'FLOAT', false],
    ['BBOX,', 'BBOX', true],
    ['BBOX,', 'IMAGE', true],
    ['*', 'ANYTHING', true],
    ['', 'ANYTHING', true]
  ]
  it.for(cases)('%s to %s -> %s', ([producer, consumer, expected]) => {
    expect(isTypeCompatible(producer, consumer)).toBe(expected)
  })
})

describe('packOf', () => {
  const cases: Array<[string | undefined, string]> = [
    ['nodes', 'core'],
    ['comfy_extras.nodes_x', 'core'],
    ['custom_nodes.ComfyUI-Impact-Pack', 'ComfyUI-Impact-Pack'],
    [undefined, 'core']
  ]
  it.for(cases)('%s -> %s', ([pythonModule, expected]) => {
    expect(packOf(pythonModule)).toBe(expected)
  })
})

describe('normalizeNodeDefs', () => {
  it('normalizes combo forms, socketless inputs, and output names', () => {
    const normalized = normalizeNodeDefs({
      RawCombo: node({ choice: [['a', 'b'], {}] }),
      V2Combo: node({
        choice: ['COMBO', { options: ['a', 'b'], multiselect: false }]
      }),
      Socketless: node({ hidden: ['STRING', { socketless: true }] }),
      Outputs: node({}, ['IMAGE', 'MASK', ['x', 'y']], ['image'])
    })

    expect(normalized.find(({ type }) => type === 'RawCombo')?.inputs).toEqual([
      { name: 'choice', type: 'COMBO', comboOptions: ['a', 'b'] }
    ])
    expect(normalized.find(({ type }) => type === 'V2Combo')?.inputs).toEqual([
      { name: 'choice', type: 'COMBO', comboOptions: ['a', 'b'] }
    ])
    expect(
      normalized.find(({ type }) => type === 'Socketless')?.inputs
    ).toEqual([])
    expect(normalized.find(({ type }) => type === 'Outputs')?.outputs).toEqual([
      { name: 'image', type: 'IMAGE' },
      { name: 'output_1', type: 'MASK' },
      { name: 'output_2', type: 'COMBO', comboOptions: ['x', 'y'] }
    ])
  })

  it('reports unrecognizable slot types and names', () => {
    const normalized = normalizeNodeDefs({
      Weird: node(
        { strange: [42, {}], ok: ['INT', {}] },
        [7, ['a', 'b']],
        ['number', ['not', 'a', 'name']],
        'custom_nodes.weird-pack'
      )
    })
    expect(normalized[0].inputs).toEqual([{ name: 'ok', type: 'INT' }])
    expect(normalized[0].outputs).toEqual([])
    expect(normalized[0].unknownSlots).toEqual([
      'strange',
      'output[0]',
      'output[1].name'
    ])
    expect(planPairs(normalized, ['Weird']).unknownShapes).toEqual([
      'Weird.strange',
      'Weird.output[0]',
      'Weird.output[1].name'
    ])
  })

  it.for([undefined, [null], ['']])(
    'falls back for absent or falsy output names: %j',
    (outputName) => {
      expect(
        normalizeNodeDefs({ Example: node({}, ['IMAGE'], outputName) })[0]
          .outputs
      ).toEqual([{ name: 'output_0', type: 'IMAGE' }])
    }
  )
})

describe('planPairs', () => {
  const comboCases: Array<[unknown[], unknown[], boolean]> = [
    [['a', 'b'], [['a', 'b'], {}], true],
    [['b', 'a'], [['a', 'b'], {}], true],
    [['A', 'B'], [['a', 'b'], {}], false],
    [
      ['a', 'b'],
      ['COMBO', { remote: { route: '/internal/files/output' } }],
      false
    ]
  ]

  it('pairs exact and union types deterministically', () => {
    const nodes = normalizeNodeDefs(BASE_DEFS)
    const first = planPairs(nodes, ['LatentSink', 'IntSink'])
    expect(
      first.pairs.map(
        ({ producer, consumer }) =>
          `${producer.nodeType}.${producer.slotName}->${consumer.nodeType}.${consumer.slotName}`
      )
    ).toEqual([
      'LatentSource.LATENT->LatentSink.latent',
      'UnionSource.value->IntSink.value'
    ])
    expect(planPairs(nodes, ['LatentSink', 'IntSink'])).toEqual(first)
    expect(first.unknownShapes).toEqual([])
  })

  it('adds required pairs and fails closed when their contract changes', () => {
    const defs = {
      Source: node({}, ['IMAGE'], ['image'], 'custom_nodes.Example'),
      AlphaSink: node({ image: ['IMAGE', {}] }),
      RequiredSink: node({ image: ['IMAGE', {}] })
    }
    const nodes = normalizeNodeDefs(defs)
    const exact = planPairs(
      nodes,
      ['Source'],
      ['Source.image -> RequiredSink.image']
    )
    expect(
      exact.pairs.map(
        ({ producer, consumer }) =>
          `${producer.nodeType}.${producer.slotName} -> ${consumer.nodeType}.${consumer.slotName}`
      )
    ).toEqual([
      'Source.image -> AlphaSink.image',
      'Source.image -> RequiredSink.image'
    ])
    expect(exact.requiredPairIssues).toEqual([])

    expect(
      planPairs(
        nodes,
        ['Source'],
        [
          'Source.missing -> RequiredSink.image',
          'Absent.output -> RequiredSink.image'
        ]
      ).requiredPairIssues
    ).toEqual([
      'Source.missing -> RequiredSink.image: declared slot is no longer present',
      'Absent.output -> RequiredSink.image: unknown node type(s): Absent'
    ])
  })

  it.for(comboCases)(
    'pairs combo vocabularies only when evidenced: %j / %j',
    ([sourceOptions, sinkSpec, pairs]) => {
      const defs = {
        Source: node({}, [sourceOptions], ['choice']),
        Sink: node({ choice: sinkSpec })
      }
      const plan = planPairs(normalizeNodeDefs(defs), ['Source', 'Sink'])
      expect(plan.pairs.length > 0).toBe(pairs)
      expect(plan.combos.length === 0).toBe(pairs)
    }
  )

  it('records wildcards and orphan types without pairing them', () => {
    const defs = {
      Wildcard: node({ anything: ['*', {}] }, ['*'], ['out']),
      Orphan: node(
        {},
        ['NOBODY_CONSUMES_THIS'],
        ['orphan'],
        'custom_nodes.OrphanPack'
      )
    }
    const plan = planPairs(normalizeNodeDefs(defs), ['Wildcard', 'Orphan'])
    expect(plan.wildcards.map(({ nodeType }) => nodeType)).toEqual([
      'Wildcard',
      'Wildcard'
    ])
    expect(plan.orphans).toEqual([
      {
        nodeType: 'Orphan',
        pack: 'OrphanPack',
        slotName: 'orphan',
        slotType: 'NOBODY_CONSUMES_THIS',
        dir: 'out'
      }
    ])
    expect(plan.pairs).toEqual([])
  })
})
