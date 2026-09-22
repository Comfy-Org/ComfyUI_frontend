import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import {
  SemanticDocRegistry,
  isLocalUpdateOrigin,
  isRemoteUpdateOrigin,
  ownerLinksMap,
  ownerNodesMap
} from './semanticDoc'
import type { MembershipSink, RemoteUpdateOrigin } from './semanticDoc'

const rootA = toRootGraphId('root-a')
const rootB = toRootGraphId('root-b')
const origin: RemoteUpdateOrigin = { source: 'agent-remote', actor: 'agent:x' }

const catalog: WidgetCatalog = {
  types: { Source: { widget_order: ['steps'] }, Sink: { widget_order: [] } }
}

function mintHost(): Y.Doc {
  return mint(
    {
      nodes: [
        {
          id: 1,
          type: 'Source',
          inputs: [],
          outputs: [{ name: 'out', type: 'IMAGE', links: [9] }],
          widgets_values: [20]
        },
        {
          id: 2,
          type: 'Sink',
          inputs: [{ name: 'image', type: 'IMAGE', link: 9 }],
          outputs: []
        }
      ],
      links: [[9, 1, 0, 2, 0, 'IMAGE']]
    },
    catalog
  )
}

function delta(host: Y.Doc, follower: Y.Doc | undefined): Uint8Array {
  return Y.encodeStateAsUpdate(
    host,
    follower ? Y.encodeStateVector(follower) : undefined
  )
}

function setSteps(host: Y.Doc, value: number, version: number): void {
  const op: Op = {
    op: 'set_widget',
    op_id: `set-steps-${version}`,
    actor: 'agent:x',
    base_version: version,
    stamp: [version, 'agent:x'],
    node_id: 1,
    widget: 'steps',
    value
  }
  const result = applyOps(host, [op], catalog)
  expect(result.outcomes.map(({ outcome }) => outcome)).toEqual(['applied'])
}

describe('SemanticDocRegistry', () => {
  const registry = new SemanticDocRegistry()
  const hosts: Y.Doc[] = []

  function host(): Y.Doc {
    const doc = mintHost()
    hosts.push(doc)
    return doc
  }

  afterEach(() => {
    registry.destroyAll()
    for (const doc of hosts.splice(0)) doc.destroy()
  })

  it('reads an unknown root graph as empty without creating a document', () => {
    expect(registry.readGraph(rootA)).toEqual({ nodes: {}, links: {} })
    expect(registry.hasNode(rootA, toNodeId(1))).toBe(false)
    expect(registry.readDefinitions(rootA)).toEqual({})
    expect(registry.has(rootA)).toBe(false)
    expect(registry.get(rootA)).toBeUndefined()
  })

  it('merges a minted host into a fresh document and exposes its graph', () => {
    registry.applyRemote(rootA, delta(host(), undefined), origin)

    const graph = registry.readGraph(rootA)
    expect(Object.keys(graph.nodes).sort()).toEqual(['1', '2'])
    expect(graph.nodes['1']).toMatchObject({
      type: 'Source',
      widgets: { steps: 20 }
    })
    expect(Object.keys(graph.links)).toEqual(['9'])
    expect(registry.hasNode(rootA, toNodeId(1))).toBe(true)
    expect(registry.hasNode(rootA, toNodeId(3))).toBe(false)
  })

  it('keeps root graphs in separate documents', () => {
    registry.applyRemote(rootA, delta(host(), undefined), origin)

    expect(registry.has(rootB)).toBe(false)
    expect(registry.readGraph(rootB).nodes).toEqual({})
    registry.ensure(rootB)
    expect(registry.get(rootB)).not.toBe(registry.get(rootA))
    expect(registry.readGraph(rootB).nodes).toEqual({})
  })

  it('carries the remote origin as the transaction origin', () => {
    const doc = registry.ensure(rootA)
    const origins: unknown[] = []
    doc.on('afterTransaction', (transaction: Y.Transaction) => {
      origins.push(transaction.origin)
    })

    registry.applyRemote(rootA, delta(host(), undefined), origin)

    expect(origins).toHaveLength(1)
    expect(origins[0]).toBe(origin)
    expect(isRemoteUpdateOrigin(origins[0])).toBe(true)
  })

  it('never adds a layout root and never reads a root into existence', () => {
    registry.applyRemote(rootA, delta(host(), undefined), origin)
    registry.observe(rootA, () => {})
    registry.readDefinitions(rootA)
    registry.readGraph(rootA)

    const roots = [...registry.ensure(rootA).share.keys()]
    expect(roots).toEqual(expect.arrayContaining(['nodes', 'links']))
    expect(
      roots.filter((root) => /layout|viewport|group|reroute/i.test(root))
    ).toEqual([])
    expect(roots).not.toContain('definitions')
  })

  it('attaching observers adds no document content', () => {
    const doc = registry.ensure(rootA)
    const before = Y.encodeStateAsUpdate(doc)
    const sharesBefore = doc.share.size

    registry.observe(rootA, () => {})

    expect(doc.share.size).toBeGreaterThan(sharesBefore)
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before)
  })

  it('notifies observers of nested remote changes and stops after unsubscribe', () => {
    const hostDoc = host()
    registry.applyRemote(rootA, delta(hostDoc, undefined), origin)
    const seen: { keys: string[]; origin: unknown }[] = []
    const listener = vi.fn(
      (
        events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
        transaction: Y.Transaction
      ) => {
        // `changes` may only be read while the handler runs.
        seen.push({
          keys: events.flatMap((event) => [...event.changes.keys.keys()]),
          origin: transaction.origin
        })
      }
    )
    const stop = registry.observe(rootA, listener)

    setSteps(hostDoc, 30, 1)
    registry.applyRemote(rootA, delta(hostDoc, registry.get(rootA)), origin)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(seen[0].origin).toBe(origin)
    expect(seen[0].keys).toContain('steps')
    expect(registry.readGraph(rootA).nodes['1']).toMatchObject({
      widgets: { steps: 30 }
    })

    stop()
    setSteps(hostDoc, 40, 2)
    registry.applyRemote(rootA, delta(hostDoc, registry.get(rootA)), origin)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(registry.readGraph(rootA).nodes['1']).toMatchObject({
      widgets: { steps: 40 }
    })
  })

  it('destroy forgets the document and detaches its observers', () => {
    const hostDoc = host()
    registry.applyRemote(rootA, delta(hostDoc, undefined), origin)
    const doc = registry.get(rootA)
    const listener = vi.fn()
    registry.observe(rootA, listener)

    registry.destroy(rootA)

    expect(registry.has(rootA)).toBe(false)
    expect(registry.readGraph(rootA).nodes).toEqual({})
    // A stale handle to the destroyed document is inert for the registry.
    registry.applyRemote(rootA, delta(hostDoc, undefined), origin)
    expect(registry.get(rootA)).not.toBe(doc)
    expect(listener).not.toHaveBeenCalled()
    expect(registry.readGraph(rootA).nodes['1']).toBeDefined()
  })

  it('isRemoteUpdateOrigin rejects local and malformed origins', () => {
    expect(isRemoteUpdateOrigin(null)).toBe(false)
    expect(isRemoteUpdateOrigin(Symbol('local'))).toBe(false)
    expect(isRemoteUpdateOrigin({ source: 'agent-remote' })).toBe(false)
    expect(isRemoteUpdateOrigin({ source: 'human', actor: 'u' })).toBe(false)
  })

  it('isLocalUpdateOrigin accepts bare and attributed local origins only', () => {
    expect(isLocalUpdateOrigin({ source: 'local' })).toBe(true)
    expect(
      isLocalUpdateOrigin({ source: 'local', actor: 'a', opId: 'op' })
    ).toBe(true)
    expect(isLocalUpdateOrigin({ source: 'local', actor: 1 })).toBe(false)
    expect(isLocalUpdateOrigin(origin)).toBe(false)
    expect(isLocalUpdateOrigin(null)).toBe(false)
  })

  it('transactLocal runs one transaction carrying the local origin', () => {
    const listener = vi.fn()
    registry.observe(rootA, listener)
    const local = { source: 'local' as const, actor: 'user', opId: 'op-1' }

    registry.transactLocal(rootA, local, (doc) => {
      const nodes = ownerNodesMap(doc, rootA, toOwningGraphId('root-a'), true)
      nodes.set('1', new Y.Map([['type', 'Source']]))
      nodes.set('2', new Y.Map([['type', 'Sink']]))
    })

    expect(listener).toHaveBeenCalledTimes(1)
    const transaction = listener.mock.calls[0][1] as Y.Transaction
    expect(transaction.origin).toBe(local)
    expect(isRemoteUpdateOrigin(transaction.origin)).toBe(false)
    expect([...registry.ensure(rootA).getMap('nodes').keys()]).toEqual([
      '1',
      '2'
    ])
    // A document filled only locally carries no host `meta.schema_version`,
    // so the package reader refuses it; slice 2a does not stamp meta.
    expect(() => registry.readGraph(rootA)).toThrow(/schema_version/)
  })

  it('ownerNodesMap resolves the root owner to the nodes share', () => {
    const doc = registry.ensure(rootA)
    const nodes = ownerNodesMap(doc, rootA, toOwningGraphId('root-a'), false)
    expect(nodes).toBe(doc.getMap('nodes'))
    expect(doc.share.has('definitions')).toBe(false)
  })

  it('ownerNodesMap never materialises a definition path without create', () => {
    const doc = registry.ensure(rootA)
    const sub = toOwningGraphId('sub-1')

    expect(ownerNodesMap(doc, rootA, sub, false)).toBeUndefined()
    expect(doc.share.has('definitions')).toBe(false)

    doc.getMap('definitions').set('sub-1', new Y.Map())
    expect(ownerNodesMap(doc, rootA, sub, false)).toBeUndefined()
    expect(registry.readDefinitions(rootA)).toEqual({ 'sub-1': {} })

    const created = ownerNodesMap(doc, rootA, sub, true)
    expect(created).toBeInstanceOf(Y.Map)
    expect(ownerNodesMap(doc, rootA, sub, false)).toBe(created)
    expect(ownerNodesMap(doc, rootA, sub, true)).toBe(created)
    expect(registry.readDefinitions(rootA)).toEqual({ 'sub-1': { nodes: {} } })
  })

  it('observeNodes sees definition-owned nodes that observe does not', () => {
    const onGraph = vi.fn()
    const onNodes = vi.fn()
    registry.observe(rootA, onGraph)
    const stop = registry.observeNodes(rootA, onNodes)

    registry.transactLocal(rootA, { source: 'local' }, (doc) => {
      ownerNodesMap(doc, rootA, toOwningGraphId('sub-1'), true).set(
        '5',
        new Y.Map([['type', 'Sink']])
      )
    })

    expect(onGraph).not.toHaveBeenCalled()
    expect(onNodes).toHaveBeenCalledTimes(1)
    const events = onNodes.mock.calls[0][0] as Y.YEvent<
      Y.AbstractType<unknown>
    >[]
    expect(events.map((event) => event.path)).toEqual([[]])

    stop()
    registry.transactLocal(rootA, { source: 'local' }, (doc) => {
      ownerNodesMap(doc, rootA, toOwningGraphId('root-a'), true).set(
        '6',
        new Y.Map([['type', 'Sink']])
      )
    })
    expect(onNodes).toHaveBeenCalledTimes(1)
    expect(onGraph).toHaveBeenCalledTimes(1)
  })

  it('ownerLinksMap resolves the root owner to the links share and gates definitions', () => {
    const doc = registry.ensure(rootA)
    const sub = toOwningGraphId('sub-1')
    expect(ownerLinksMap(doc, rootA, toOwningGraphId('root-a'), false)).toBe(
      doc.getMap('links')
    )
    expect(ownerLinksMap(doc, rootA, sub, false)).toBeUndefined()
    expect(doc.share.has('definitions')).toBe(false)

    ownerNodesMap(doc, rootA, sub, true)
    expect(ownerLinksMap(doc, rootA, sub, false)).toBeUndefined()

    const created = ownerLinksMap(doc, rootA, sub, true)
    expect(ownerLinksMap(doc, rootA, sub, false)).toBe(created)
    expect(registry.readDefinitions(rootA)).toEqual({
      'sub-1': { nodes: {}, links: {} }
    })
  })

  it('observeLinks sees root and definition-owned links, not nodes', () => {
    const onLinks = vi.fn()
    const stop = registry.observeLinks(rootA, onLinks)

    registry.transactLocal(rootA, { source: 'local' }, (doc) => {
      ownerNodesMap(doc, rootA, toOwningGraphId('root-a'), true).set(
        '5',
        new Y.Map([['type', 'Sink']])
      )
    })
    expect(onLinks).not.toHaveBeenCalled()

    registry.transactLocal(rootA, { source: 'local' }, (doc) => {
      ownerLinksMap(doc, rootA, toOwningGraphId('root-a'), true).set('1', [
        1,
        '5',
        0,
        '9',
        2,
        'INT'
      ])
      ownerLinksMap(doc, rootA, toOwningGraphId('sub-1'), true).set('2', [
        2,
        '7',
        0,
        '8',
        0,
        'INT'
      ])
    })
    expect(onLinks).toHaveBeenCalledTimes(2)

    stop()
    registry.transactLocal(rootA, { source: 'local' }, (doc) => {
      ownerLinksMap(doc, rootA, toOwningGraphId('root-a'), true).delete('1')
    })
    expect(onLinks).toHaveBeenCalledTimes(2)
  })

  it('projectMembership seeds, forwards key changes and reseeds replaced definitions', () => {
    const doc = registry.ensure(rootA)
    const rootOwner = toOwningGraphId('root-a')
    const sub = toOwningGraphId('sub-1')
    ownerLinksMap(doc, rootA, rootOwner, true).set('1', [
      1,
      '5',
      0,
      '9',
      2,
      'X'
    ])
    ownerLinksMap(doc, rootA, sub, true).set('2', [2, '7', 0, '8', 0, 'X'])

    const members = new Map<string, Set<string>>()
    const sink: MembershipSink = {
      add: (owner, id) => {
        const ids = members.get(owner) ?? new Set()
        ids.add(id)
        members.set(owner, ids)
      },
      remove: (owner, id) => {
        members.get(owner)?.delete(id)
      },
      resetDefinitionOwners: vi.fn(() => {
        for (const owner of [...members.keys()])
          if (owner !== 'root-a') members.delete(owner)
      })
    }
    const stop = registry.projectMembership(rootA, 'links', sink)
    expect([...members]).toEqual([
      ['root-a', new Set(['1'])],
      ['sub-1', new Set(['2'])]
    ])

    registry.transactLocal(rootA, { source: 'local' }, (d) => {
      ownerLinksMap(d, rootA, rootOwner, true).delete('1')
      ownerLinksMap(d, rootA, sub, true).set('3', [3, '7', 1, '8', 1, 'X'])
    })
    expect(members.get('root-a')).toEqual(new Set())
    expect(members.get('sub-1')).toEqual(new Set(['2', '3']))
    expect(sink.resetDefinitionOwners).not.toHaveBeenCalled()

    // Replacing the whole definition entry cannot be expressed as key events
    // on the old links map, so the projection resets and reseeds.
    registry.transactLocal(rootA, { source: 'local' }, (d) => {
      const definition = new Y.Map<unknown>()
      const links = new Y.Map<unknown>([['4', [4, '1', 0, '2', 0, 'X']]])
      definition.set('links', links)
      d.getMap('definitions').set('sub-1', definition)
    })
    expect(sink.resetDefinitionOwners).toHaveBeenCalledTimes(1)
    expect(members.get('sub-1')).toEqual(new Set(['4']))

    stop()
    registry.transactLocal(rootA, { source: 'local' }, (d) => {
      ownerLinksMap(d, rootA, rootOwner, true).set('9', [
        9,
        '1',
        0,
        '2',
        0,
        'X'
      ])
    })
    expect(members.get('root-a')).toEqual(new Set())
  })
})
