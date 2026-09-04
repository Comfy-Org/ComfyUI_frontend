import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type {
  ExportedSubgraph,
  ISerialisedNode,
  SerialisableLLink
} from '@/lib/litegraph/src/types/serialisation'

import { readSubgraphDefinitions } from './agentSubgraphDefinitions'

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

function expectYMap(value: unknown): Y.Map<unknown> {
  expect(value).toBeInstanceOf(Y.Map)
  if (!(value instanceof Y.Map)) throw new TypeError('Expected a Y.Map')
  return value
}

function expectStringArray(value: unknown): string[] {
  expect(Array.isArray(value)).toBe(true)
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TypeError('Expected a string array')
  }
  return value
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

  it('projects a definition back to the shape it was minted from', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(3), interiorNode(1)],
      links: [interiorLink(9, 3, 1), interiorLink(4, 1, 3)]
    })

    const [projected] = readSubgraphDefinitions(seed(definition))

    expect(projected).toEqual(definition)
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

  it('drops the op layer incarnation stamp from interior nodes', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const doc = seed(definition)
    const stored = expectYMap(
      expectYMap(doc.getMap<unknown>('definitions').get(definition.id)).get(
        'nodes'
      )
    )
    expect(expectYMap(stored.get('1')).has('__incarnation')).toBe(true)

    const [projected] = readSubgraphDefinitions(doc)

    expect(projected.nodes?.[0]).not.toHaveProperty('__incarnation')
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

  it('skips definition and node entries that are not records', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1)]
    })
    const doc = seed(definition)
    doc.transact(() => {
      const definitions = doc.getMap<unknown>('definitions')
      definitions.set('not-a-definition', 'nope')
      const stored = expectYMap(definitions.get(definition.id))
      expectYMap(stored.get('nodes')).set('99', 'nope')
      stored.set('node_order', [
        ...expectStringArray(stored.get('node_order')),
        '99'
      ])
    })

    const projected = readSubgraphDefinitions(doc)

    expect(projected).toHaveLength(1)
    expect(projected[0]?.nodes?.map((node) => node.id)).toEqual([1])
  })

  it('reads a node named twice in the order register once', () => {
    // mintDefinition pushes one register entry per input node, so two interior
    // nodes sharing an id leave a two-entry register over a one-key map.
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1), interiorNode(1), interiorNode(2)],
      links: [interiorLink(5, 1, 2), interiorLink(5, 1, 2)]
    })

    const [projected] = readSubgraphDefinitions(seed(definition))

    expect(projected.nodes?.map((node) => node.id)).toEqual([1, 2])
    expect(projected.links?.map((link) => link.id)).toEqual([5])
  })

  it('skips a node whose widgets entry is not a map, as the package does', () => {
    const definition = createTestSubgraphData({
      nodes: [interiorNode(1), interiorNode(2)]
    })
    const doc = seed(definition)
    doc.transact(() => {
      const stored = expectYMap(
        doc.getMap<unknown>('definitions').get(definition.id)
      )
      const first = expectYMap(expectYMap(stored.get('nodes')).get('1'))
      first.set('widgets', 'nope')
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
      const stored = expectYMap(
        doc.getMap<unknown>('definitions').get(definition.id)
      )
      const node = expectYMap(expectYMap(stored.get('nodes')).get('1'))
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
      const stored = expectYMap(
        doc.getMap<unknown>('definitions').get(definition.id)
      )
      stored.set('__proto__', { polluted: true })
      const node = expectYMap(expectYMap(stored.get('nodes')).get('1'))
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
