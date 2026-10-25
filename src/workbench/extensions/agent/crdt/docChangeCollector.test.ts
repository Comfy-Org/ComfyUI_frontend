import {
  linksMap,
  nodesMap,
  OPAQUE_WIDGETS_KEY
} from '@comfyorg/comfy-multi-player'
import { describe, expect, it, onTestFinished } from 'vitest'
import * as Y from 'yjs'

import { DocChangeCollector } from './docChangeCollector'

function docNode(fields: Record<string, unknown> = {}): Y.Map<unknown> {
  return new Y.Map<unknown>(
    Object.entries({ type: 'Test', pos: [0, 0], ...fields })
  )
}

function setup() {
  const doc = new Y.Doc()
  const collector = new DocChangeCollector(doc)
  onTestFinished(() => {
    collector.destroy()
    doc.destroy()
  })
  doc.transact(() => {
    nodesMap(doc).set('1', docNode({ widgets: new Y.Map([['seed', 1]]) }))
    nodesMap(doc).set('2', docNode())
  })
  collector.take()
  return { doc, collector }
}

describe('DocChangeCollector', () => {
  it('records node adds, updates and deletes by document key', () => {
    const { doc, collector } = setup()

    doc.transact(() => {
      nodesMap(doc).set('3', docNode())
      nodesMap(doc).set('2', docNode({ type: 'Other' }))
      nodesMap(doc).delete('1')
    })

    expect([...collector.take().nodes]).toEqual([
      ['3', 'add'],
      ['2', 'update'],
      ['1', 'delete']
    ])
  })

  it('keeps only the effective action for a node id touched repeatedly before a take', () => {
    const { doc, collector } = setup()

    doc.transact(() => {
      nodesMap(doc).set('3', docNode())
      nodesMap(doc).set('3', docNode({ type: 'Other' }))
      nodesMap(doc).delete('3')
      nodesMap(doc).set('2', docNode({ type: 'Other' }))
      nodesMap(doc).delete('2')
    })
    doc.transact(() => nodesMap(doc).set('4', docNode()))
    doc.transact(() => nodesMap(doc).delete('4'))

    expect([...collector.take().nodes]).toEqual([
      ['2', 'delete'],
      ['4', 'delete']
    ])
  })

  it('records named widget edits per node and a replaced storage as all', () => {
    const { doc, collector } = setup()

    doc.transact(() => {
      const widgets = nodesMap(doc).get('1')?.get('widgets')
      if (!(widgets instanceof Y.Map)) throw new Error('named storage')
      widgets.set('steps', 20)
      widgets.set('seed', 2)
    })
    expect(collector.take().widgets).toEqual(
      new Map([['1', new Set(['steps', 'seed'])]])
    )

    doc.transact(() => {
      nodesMap(doc).get('2')?.set(OPAQUE_WIDGETS_KEY, [1, 2])
    })
    expect(collector.take().widgets).toEqual(new Map([['2', 'all']]))

    doc.transact(() => {
      const opaque = new Y.Array<unknown>()
      nodesMap(doc).get('2')?.set(OPAQUE_WIDGETS_KEY, opaque)
    })
    collector.take()
    doc.transact(() => {
      const opaque = nodesMap(doc).get('2')?.get(OPAQUE_WIDGETS_KEY)
      if (!(opaque instanceof Y.Array)) throw new Error('opaque storage')
      opaque.push([7])
    })
    expect(collector.take().widgets).toEqual(new Map([['2', 'all']]))
  })

  it('flags a node for field resync only when a synced field changes', () => {
    const { doc, collector } = setup()

    doc.transact(() => {
      nodesMap(doc).get('1')?.set('pos', [10, 10])
      nodesMap(doc).get('2')?.set('title', 'Renamed')
    })

    const changes = collector.take()
    expect(changes.resyncNodes).toEqual(new Map([['2', new Set(['title'])]]))
    expect(changes.nodes.size).toBe(0)
  })

  it('flags a node for field resync when one flag register changes inside its nested flags map', () => {
    const { doc, collector } = setup()
    doc.transact(() => {
      nodesMap(doc)
        .get('1')
        ?.set('flags', new Y.Map([['pinned', true]]))
    })
    collector.take()

    doc.transact(() => {
      const flags = nodesMap(doc).get('1')?.get('flags')
      if (!(flags instanceof Y.Map)) throw new Error('nested flags')
      flags.set('collapsed', true)
    })

    const changes = collector.take()
    expect(changes.resyncNodes).toEqual(
      new Map([['1', new Set(['flags.collapsed'])]])
    )
    expect(changes.widgets.size).toBe(0)
  })

  it('records interior widget edits under their definition and node (FE-3468)', () => {
    const { doc, collector } = setup()
    doc.transact(() => {
      const definitions = doc.getMap<Y.Map<unknown>>('definitions')
      const interior = new Y.Map<unknown>([
        ['type', 'Test'],
        ['widgets', new Y.Map<unknown>([['value', 1]])]
      ])
      const nodes = new Y.Map<unknown>([['7', interior]])
      const definition = new Y.Map<unknown>([
        ['id', 'def-1'],
        ['nodes', nodes]
      ])
      definitions.set('def-1', definition)
    })
    collector.take()

    doc.transact(() => {
      const definitions = doc.getMap<Y.Map<unknown>>('definitions')
      const definition = definitions.get('def-1') as Y.Map<unknown>
      const nodes = definition.get('nodes') as Y.Map<unknown>
      const interior = nodes.get('7') as Y.Map<unknown>
      const widgets = interior.get('widgets') as Y.Map<unknown>
      widgets.set('value', 42)
    })

    const changes = collector.take()
    expect(changes.interiors?.get('def-1')?.get('7')).toEqual(
      new Set(['value'])
    )
    expect(changes.nodes.size).toBe(0)
  })

  it('records link keys, clears on take, and stops observing after destroy', () => {
    const { doc, collector } = setup()

    doc.transact(() => {
      linksMap(doc).set('9', [9, 1, 0, 2, 0, 'IMAGE'])
    })
    expect(collector.take().links).toEqual(new Set(['9']))
    expect(collector.take().links).toEqual(new Set())

    collector.destroy()
    doc.transact(() => {
      linksMap(doc).delete('9')
      nodesMap(doc).set('4', docNode())
    })
    const after = collector.take()
    expect(after.links.size + after.nodes.size).toBe(0)
  })
})
