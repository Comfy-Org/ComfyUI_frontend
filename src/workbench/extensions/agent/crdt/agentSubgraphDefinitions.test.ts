import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { assert, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type {
  ExportedSubgraph,
  ISerialisedNode,
  SerialisableLLink
} from '@/lib/litegraph/src/types/serialisation'

import {
  readSubgraphDefinitionIds,
  readSubgraphDefinitions
} from './agentSubgraphDefinitions'

const CATALOG: WidgetCatalog = {
  types: {
    dummy: { widget_order: [] },
    'widget-node': { widget_order: ['seed', 'steps'] }
  }
}

function interiorNode(
  id: number,
  type = 'dummy',
  extra: Partial<ISerialisedNode> = {}
): ISerialisedNode {
  return {
    id,
    type,
    pos: [0, 0],
    size: [100, 80],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [],
    outputs: [],
    ...extra
  }
}

function interiorLink(
  id: number,
  origin: number,
  target: number
): SerialisableLLink {
  return {
    id,
    origin_id: origin,
    origin_slot: 0,
    target_id: target,
    target_slot: 0,
    type: 'IMAGE'
  }
}

function seed(...definitions: ExportedSubgraph[]): Y.Doc {
  return mint(
    {
      nodes: [],
      links: [],
      definitions: { subgraphs: definitions }
    },
    CATALOG
  )
}

function storedDefinition(doc: Y.Doc, id: string): Y.Map<unknown> {
  const definition = doc.getMap<unknown>('definitions').get(id)
  assert.instanceOf(definition, Y.Map)
  return definition
}

function storedNode(definition: Y.Map<unknown>, id: number): Y.Map<unknown> {
  const nodes = definition.get('nodes')
  assert.instanceOf(nodes, Y.Map)
  const node = nodes.get(String(id))
  assert.instanceOf(node, Y.Map)
  return node
}

function nestedDefinitionChain(depth: number): Record<string, unknown> {
  let current: Record<string, unknown> = { id: `nested-${depth}` }
  for (let index = depth - 1; index >= 0; index--) {
    current = {
      id: `nested-${index}`,
      definitions: { subgraphs: [current] }
    }
  }
  return current
}

describe('readSubgraphDefinitions', () => {
  it('returns nothing for a document without definitions', () => {
    expect(readSubgraphDefinitions(new Y.Doc())).toEqual([])
    expect(readSubgraphDefinitions(seed())).toEqual([])
  })

  it('does not create the definitions root on a document that lacks it', () => {
    const doc = new Y.Doc()

    readSubgraphDefinitions(doc)

    // `Y.Doc.getMap` defines the shared type as a side effect; a reader must
    // leave the document's shape alone.
    expect(doc.share.has('definitions')).toBe(false)
  })

  it('ignores a definitions root with the wrong shared type', () => {
    const doc = new Y.Doc()
    doc.getArray('definitions')

    expect(readSubgraphDefinitionIds(doc)).toEqual([])
    expect(readSubgraphDefinitions(doc)).toEqual([])
  })

  it('projects a definition back to the shape it was minted from', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(3), interiorNode(1)],
      links: [interiorLink(9, 3, 1), interiorLink(4, 1, 3)]
    })

    const [projected] = readSubgraphDefinitions(seed(definition))

    expect(projected).toEqual(definition)
  })

  it('does not project an excluded definition body', () => {
    const excluded = createTestSubgraphData({ nodes: [interiorNode(1)] })
    const included = createTestSubgraphData({ nodes: [interiorNode(2)] })
    const doc = seed(excluded, included)
    const body = new Y.Text('expensive body')
    storedDefinition(doc, excluded.id).set('name', body)
    const toJSON = vi.spyOn(body, 'toJSON')

    expect(readSubgraphDefinitions(doc, new Set([excluded.id]))).toEqual([
      included
    ])
    expect(toJSON).not.toHaveBeenCalled()
  })

  it('does not project an excluded nested definition body', () => {
    const excluded = createTestSubgraphData({ nodes: [interiorNode(1)] })
    const included = createTestSubgraphData({ nodes: [interiorNode(2)] })
    const outer = createTestSubgraphData({
      definitions: { subgraphs: [excluded, included] }
    })
    const doc = seed(outer)
    const nestedDefinitions = storedDefinition(doc, outer.id).get('definitions')
    assert.instanceOf(nestedDefinitions, Y.Map)
    const nestedSubgraphs = nestedDefinitions.get('subgraphs')
    assert.instanceOf(nestedSubgraphs, Y.Map)
    const storedExcluded = nestedSubgraphs.get(excluded.id)
    assert.instanceOf(storedExcluded, Y.Map)
    const body = new Y.Text('expensive nested body')
    storedExcluded.set('name', body)
    const toJSON = vi.spyOn(body, 'toJSON')

    expect(readSubgraphDefinitions(doc, new Set([excluded.id]))).toEqual([
      { ...outer, definitions: { subgraphs: [included] } }
    ])
    expect(toJSON).not.toHaveBeenCalled()
  })

  it('keeps interior nodes and links in mint order, not key order', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(10), interiorNode(2), interiorNode(7)],
      links: [
        interiorLink(30, 10, 2),
        interiorLink(5, 2, 7),
        interiorLink(12, 7, 10)
      ]
    })

    const [projected] = readSubgraphDefinitions(seed(definition))

    expect(projected.nodes?.map((node) => node.id)).toEqual([10, 2, 7])
    expect(projected.links?.map((link) => link.id)).toEqual([30, 5, 12])
  })

  it('emits catalogued widget values by name and opaque ones positionally', () => {
    const definition = createTestSubgraphData({
      nodes: [
        interiorNode(1, 'widget-node', { widgets_values: [42, 20] }),
        interiorNode(2, 'unknown-node', { widgets_values: ['a', 'b'] })
      ]
    })

    const [projected] = readSubgraphDefinitions(seed(definition))

    expect(projected.nodes?.[0]).toMatchObject({
      widgets_values_named: { seed: 42, steps: 20 }
    })
    expect(projected.nodes?.[0]).not.toHaveProperty('widgets_values')
    expect(projected.nodes?.[1]).toMatchObject({ widgets_values: ['a', 'b'] })
    expect(projected.nodes?.[1]).not.toHaveProperty('widgets_values_named')
  })

  it('sanitizes named widgets recursively without changing stored values', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1, 'widget-node', { widgets_values: [42, 20] })]
    })
    const doc = seed(definition)
    const stored = storedDefinition(doc, definition.id)
    const widgets = storedNode(stored, 1).get('widgets')
    assert.instanceOf(widgets, Y.Map)
    const nested: Record<string, unknown> = { safe: 'kept' }
    Object.defineProperty(nested, '__proto__', {
      value: { polluted: 'nested' },
      enumerable: true
    })
    widgets.set('seed', { values: [nested] })
    widgets.set('__proto__', { polluted: 'named-widget' })
    widgets.set('__custom_widget', 'public-widget-value')
    const before = Y.encodeStateAsUpdate(doc)

    const [projected] = readSubgraphDefinitions(doc)
    const named = projected.nodes?.[0]?.widgets_values_named

    expect(named).toEqual({
      seed: { values: [{ safe: 'kept' }] },
      steps: 20,
      __custom_widget: 'public-widget-value'
    })
    expect(Object.getPrototypeOf(named)).toBe(Object.prototype)
    expect(named).not.toHaveProperty('polluted')
    expect(Object.keys(named ?? {})).not.toContain('__proto__')
    expect(Object.keys(nested)).toContain('__proto__')
    expect(widgets.get('__proto__')).toEqual({ polluted: 'named-widget' })
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it('drops the op layer incarnation stamp from interior nodes', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const doc = seed(definition)
    const node = storedNode(storedDefinition(doc, definition.id), 1)
    expect(node.has('__incarnation')).toBe(true)

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected.nodes?.[0]).not.toHaveProperty('__incarnation')
  })

  it('drops define_subgraph bookkeeping from the projected definition', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const doc = seed(definition)
    const stored = storedDefinition(doc, definition.id)
    stored.set('__definition_digest', 'cmp-owned-digest')

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected).toEqual(definition)
    expect(projected).not.toHaveProperty('__definition_digest')
    expect(stored.get('__definition_digest')).toBe('cmp-owned-digest')
  })

  it('drops define_subgraph bookkeeping from nested definitions recursively', () => {
    const deepest = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const inner = createTestSubgraphData({
      nodes: [interiorNode(2, deepest.id)],
      definitions: { subgraphs: [deepest] }
    })
    const outer = createTestSubgraphData({
      nodes: [interiorNode(3, inner.id)],
      definitions: { subgraphs: [inner] }
    })
    const doc = seed(outer)
    const stored = storedDefinition(doc, outer.id)
    const sourceDefinitions = {
      subgraphs: [
        {
          ...inner,
          __definition_digest: 'inner-digest',
          definitions: {
            subgraphs: [{ ...deepest, __definition_digest: 'deepest-digest' }]
          }
        }
      ]
    }
    stored.set('definitions', sourceDefinitions)

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected).toEqual(outer)
    expect(projected.definitions?.subgraphs?.[0]).not.toHaveProperty(
      '__definition_digest'
    )
    expect(
      projected.definitions?.subgraphs?.[0]?.definitions?.subgraphs?.[0]
    ).not.toHaveProperty('__definition_digest')
    expect(stored.get('definitions')).toEqual(sourceDefinitions)
  })

  it('drops unknown private bookkeeping from every definition depth', () => {
    const inner = createTestSubgraphData({ nodes: [interiorNode(1)] })
    const outer = createTestSubgraphData({
      nodes: [interiorNode(2, inner.id)],
      definitions: { subgraphs: [inner] }
    })
    const doc = seed(outer)
    const stored = storedDefinition(doc, outer.id)
    stored.set('__future_cmp_register', 'outer-private')
    stored.set('definitions', {
      subgraphs: [{ ...inner, __future_cmp_register: 'inner-private' }]
    })

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected).not.toHaveProperty('__future_cmp_register')
    expect(projected.definitions?.subgraphs?.[0]).not.toHaveProperty(
      '__future_cmp_register'
    )
  })

  it('drops unsafe keys inside nested definitions without mutating the source', () => {
    const inner = createTestSubgraphData({ nodes: [interiorNode(1)] })
    const outer = createTestSubgraphData({
      nodes: [interiorNode(2, inner.id)],
      definitions: { subgraphs: [inner] }
    })
    const properties: Record<string, unknown> = { safe: 'kept' }
    Object.defineProperty(properties, '__proto__', {
      value: { polluted: true },
      enumerable: true
    })
    const sourceDefinitions = {
      subgraphs: [
        {
          ...inner,
          nodes: [{ ...interiorNode(1), properties }]
        }
      ]
    }
    const doc = seed(outer)
    const stored = storedDefinition(doc, outer.id)
    stored.set('definitions', sourceDefinitions)

    const [projected] = readSubgraphDefinitions(doc)
    const projectedProperties =
      projected.definitions?.subgraphs?.[0]?.nodes?.[0]?.properties

    expect(projectedProperties).toEqual({ safe: 'kept' })
    expect(Object.keys(properties)).toContain('__proto__')
    expect(stored.get('definitions')).toEqual(sourceDefinitions)
  })

  it('passes nested definitions through untouched', () => {
    const inner = createTestSubgraphData({ nodes: [interiorNode(1)] })
    const outer = createTestSubgraphData({
      nodes: [interiorNode(2, inner.id)],
      definitions: { subgraphs: [inner] }
    })

    const [projected] = readSubgraphDefinitions(seed(outer))

    expect(projected.definitions).toEqual({ subgraphs: [inner] })
  })

  it('preserves nested order and sanitizes digests after snapshot decode without writing', () => {
    const first = createTestSubgraphData({
      id: '00000000-0000-4000-8000-000000000002'
    })
    const second = createTestSubgraphData({
      id: '00000000-0000-4000-8000-000000000001'
    })
    const outer = createTestSubgraphData({
      id: '00000000-0000-4000-8000-000000000003',
      definitions: { subgraphs: [first, second] }
    })
    const doc = seed(outer)
    const storedOuter = storedDefinition(doc, outer.id)
    storedOuter.set('__definition_digest', 'outer-digest')
    const nested = seed(second, first).getMap<Y.Map<unknown>>('definitions')
    const storedFirst = nested.get(first.id)
    assert.exists(storedFirst)
    storedFirst.set('__definition_digest', 'first-digest')
    storedFirst.set('__future_cmp_register', 'first-private')
    storedOuter.set(
      'definitions',
      new Y.Map<unknown>([
        ['subgraphs', nested.clone()],
        ['subgraph_order', [first.id, second.id]]
      ])
    )
    const follower = new Y.Doc()
    Y.applyUpdate(follower, Y.encodeStateAsUpdate(doc))
    const before = Y.encodeStateAsUpdate(follower)

    expect(readSubgraphDefinitions(follower)).toEqual([outer])
    expect(readSubgraphDefinitionIds(follower)).toEqual([
      outer.id,
      first.id,
      second.id
    ])
    expect(Y.encodeStateAsUpdate(follower)).toEqual(before)
  })

  it('projects top-level and nested definition ids without reading bodies', () => {
    const inner = createTestSubgraphData({ nodes: [interiorNode(1)] })
    const outer = createTestSubgraphData({
      nodes: [interiorNode(2, inner.id)],
      definitions: { subgraphs: [inner] }
    })

    expect(readSubgraphDefinitionIds(seed(outer))).toEqual([outer.id, inner.id])
  })

  it('normalizes shared-text definition ids like the full reader', () => {
    const definition = createTestSubgraphData()
    const doc = seed(definition)
    const stored = storedDefinition(doc, definition.id)
    const id = new Y.Text()
    stored.set('id', id)
    id.insert(0, definition.id)

    expect(readSubgraphDefinitionIds(doc)).toEqual([definition.id])
  })

  it('ignores inherited definition ids like the full reader', () => {
    const inheritedId = '00000000-0000-4000-8000-000000000099'
    const definition = createTestSubgraphData()
    const doc = seed(definition)
    const stored = storedDefinition(doc, definition.id)
    const inherited = Object.setPrototypeOf({}, { id: inheritedId })
    stored.set('definitions', { subgraphs: [inherited] })

    expect(readSubgraphDefinitionIds(doc)).toEqual([definition.id])
  })

  it('scans deeply nested definition ids without recursive stack growth', () => {
    const depth = 12_000
    const definition = createTestSubgraphData()
    const doc = seed(definition)
    const stored = storedDefinition(doc, definition.id)
    stored.set('definitions', {
      subgraphs: [nestedDefinitionChain(depth)]
    })

    const ids = readSubgraphDefinitionIds(doc)

    expect(ids).toHaveLength(depth + 2)
    expect(ids[0]).toBe(definition.id)
    expect(ids[1]).toBe('nested-0')
    expect(ids.at(-1)).toBe(`nested-${depth}`)
  })

  it('skips definition and node entries that are not records', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const doc = seed(definition)
    doc.transact(() => {
      const definitions = doc.getMap<unknown>('definitions')
      definitions.set('not-a-definition', 'nope')
      const stored = storedDefinition(doc, definition.id)
      const nodes = stored.get('nodes')
      assert.instanceOf(nodes, Y.Map)
      nodes.set('99', 'nope')
      const order = stored.get('node_order')
      if (!Array.isArray(order)) throw new Error('Missing node order')
      stored.set('node_order', [...order, '99'])
    })

    const projected = readSubgraphDefinitions(doc)

    expect(projected).toHaveLength(1)
    expect(projected[0]?.nodes?.map((node) => node.id)).toEqual([1])
  })

  it.for<[string, (definition: Y.Map<unknown>) => void]>([
    ['inputs', (stored) => stored.set('inputs', 'invalid')],
    [
      'input entry',
      (stored) => {
        const inputs = new Y.Array<unknown>()
        stored.set('inputs', inputs)
        inputs.push([null])
      }
    ],
    ['nodes', (stored) => stored.set('nodes', 'invalid')],
    ['links', (stored) => stored.set('links', 'invalid')],
    ['definitions', (stored) => stored.set('definitions', 'invalid')],
    [
      'nested map definition',
      (stored) => {
        const definitions = new Y.Map<unknown>()
        const subgraphs = new Y.Map<unknown>()
        stored.set('definitions', definitions)
        definitions.set('subgraphs', subgraphs)
        definitions.set('subgraph_order', ['invalid'])
        subgraphs.set('invalid', null)
      }
    ],
    [
      'nested definition',
      (stored) => {
        const definitions = new Y.Map<unknown>()
        const subgraphs = new Y.Array<unknown>()
        stored.set('definitions', definitions)
        definitions.set('subgraphs', subgraphs)
        subgraphs.push([null])
      }
    ]
  ])('skips a definition with invalid %s', ([_label, mutate]) => {
    const definition = createTestSubgraphData()
    const doc = seed(definition)
    const stored = storedDefinition(doc, definition.id)
    mutate(stored)

    expect(readSubgraphDefinitions(doc)).toEqual([])
  })

  it('reads a node named twice in the order register once', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1), interiorNode(2)],
      links: [interiorLink(5, 1, 2)]
    })
    const doc = seed(definition)
    const stored = storedDefinition(doc, definition.id)
    stored.set('node_order', ['2', '1', '2', '1'])
    stored.set('link_order', ['5', '5'])

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected.nodes?.map((node) => node.id)).toEqual([2, 1])
    expect(projected.links?.map((link) => link.id)).toEqual([5])
  })

  it('skips a node whose widgets entry is not a map, as the package does', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1), interiorNode(2)]
    })
    const doc = seed(definition)
    doc.transact(() => {
      storedNode(storedDefinition(doc, definition.id), 1).set('widgets', 'nope')
    })

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected.nodes?.map((node) => node.id)).toEqual([2])
  })

  it('reads shared types the package never mints instead of throwing', () => {
    // Nothing in this reader may throw: it runs as a bare argument inside the
    // follower's frame reconcile, so one unreadable value would stall every
    // node on the canvas. `structuredClone` throws on any Y type; a doc host
    // folding in a raw update can put any of them into a value slot.
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const doc = seed(definition)
    doc.transact(() => {
      const stored = storedDefinition(doc, definition.id)
      const node = storedNode(stored, 1)
      const text = new Y.Text()
      node.set('title', text)
      text.insert(0, 'from text')
      const fragment = new Y.XmlFragment()
      stored.set('extra', fragment)
      fragment.insert(0, [new Y.XmlText('markup')])
      stored.set('sub', new Y.Doc())
    })

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected.nodes?.[0]?.title).toBe('from text')
    expect(projected.extra).toBe('markup')
    expect(projected).toHaveProperty('sub', {})
  })

  it('drops a `__proto__` key instead of assigning through it', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const doc = seed(definition)
    doc.transact(() => {
      const stored = storedDefinition(doc, definition.id)
      stored.set('__proto__', { polluted: true })
      const node = storedNode(stored, 1)
      node.set('__proto__', { polluted: true })
    })

    const [projected] = readSubgraphDefinitions(doc)

    expect(Object.getPrototypeOf(projected)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(projected.nodes?.[0])).toBe(Object.prototype)
    expect(projected).not.toHaveProperty('polluted')
    expect(projected.nodes?.[0]).not.toHaveProperty('polluted')
    expect(Object.keys(projected)).not.toContain('__proto__')
    expect(Object.keys(projected.nodes?.[0] ?? {})).not.toContain('__proto__')
  })
})
