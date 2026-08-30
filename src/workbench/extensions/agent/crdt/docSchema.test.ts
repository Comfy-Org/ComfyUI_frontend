import { mint } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { toNodeId } from '@/types/nodeId'

import {
  LINKS_KEY,
  NODES_KEY,
  OPAQUE_WIDGETS_KEY,
  WIDGETS_KEY,
  readDocSnapshot
} from './docSchema'

/**
 * Contract test: pins the comfy-multi-player schema v1 shape the follower reads
 * (root maps `nodes`/`links`, per-node `type`/`pos`/`widgets`). If the upstream
 * schema changes, this fails here rather than silently rendering nothing.
 */
function nodeMap(
  type: string,
  pos: number[],
  widgets: Record<string, unknown> = {}
): Y.Map<unknown> {
  const m = new Y.Map<unknown>()
  m.set('type', type)
  m.set('pos', pos)
  const w = new Y.Map<unknown>()
  for (const [k, v] of Object.entries(widgets)) w.set(k, v)
  m.set(WIDGETS_KEY, w)
  return m
}

describe('readDocSnapshot', () => {
  it('reads nodes with type, position, and name-keyed widgets', () => {
    const doc = new Y.Doc()
    doc
      .getMap<Y.Map<unknown>>(NODES_KEY)
      .set('3', nodeMap('LoadVideo', [12, 34], { fps: 24 }))

    const snap = readDocSnapshot(doc)
    expect(snap.nodes.get('3')).toEqual({
      id: toNodeId('3'),
      type: 'LoadVideo',
      pos: [12, 34],
      widgets: { fps: 24 }
    })
  })

  it('reads links as origin/target endpoints from the tuple', () => {
    const doc = new Y.Doc()
    const nodes = doc.getMap<Y.Map<unknown>>(NODES_KEY)
    nodes.set('1', nodeMap('A', [0, 0]))
    nodes.set('2', nodeMap('B', [0, 0]))
    // ComfyUI link tuple: [id, originId, originSlot, targetId, targetSlot, type]
    doc.getMap<unknown>(LINKS_KEY).set('l1', [5, 1, 0, 2, 1, 'IMAGE'])

    const snap = readDocSnapshot(doc)
    expect(snap.links.get('l1')).toEqual({
      id: 'l1',
      originId: toNodeId('1'),
      originSlot: 0,
      targetId: toNodeId('2'),
      targetSlot: 1
    })
  })

  it.for([
    ['object endpoint', [5, {}, 0, 2, 1]],
    ['non-finite endpoint', [5, 1, 0, Number.NaN, 1]],
    ['negative slot', [5, 1, -1, 2, 1]],
    ['fractional slot', [5, 1, 0, 2, 1.5]],
    ['non-numeric slot', [5, 1, '0', 2, 1]]
  ] as [string, unknown[]][])(
    'skips a link with an invalid $0',
    ([_name, tuple]) => {
      const doc = new Y.Doc()
      doc.getMap<unknown>(LINKS_KEY).set('bad', tuple)

      expect(readDocSnapshot(doc).links.size).toBe(0)
    }
  )

  it('skips entries without a valid type and defaults a missing position', () => {
    const doc = new Y.Doc()
    const nodes = doc.getMap<Y.Map<unknown>>(NODES_KEY)
    const noType = new Y.Map<unknown>()
    noType.set('pos', [1, 2])
    nodes.set('bad', noType)
    const noPos = new Y.Map<unknown>()
    noPos.set('type', 'C')
    nodes.set('9', noPos)

    const snap = readDocSnapshot(doc)
    expect(snap.nodes.has('bad')).toBe(false)
    expect(snap.nodes.get('9')?.pos).toEqual([0, 0])
  })

  it('discrimination probe: rejects a representative LAYOUT node entry', () => {
    // Both the semantic and the layout doc root-map 'nodes', so root names
    // cannot discriminate them; the entry SHAPE must. This is a realistic
    // layout-doc node (geometry, no `type`) - cross-applied, it must read
    // as zero nodes, never as a mangled semantic node.
    const doc = new Y.Doc()
    const layoutEntry = new Y.Map<unknown>()
    const position = new Y.Map<unknown>()
    position.set('x', 120)
    position.set('y', 80)
    const size = new Y.Map<unknown>()
    size.set('width', 210)
    size.set('height', 90)
    layoutEntry.set('position', position)
    layoutEntry.set('size', size)
    layoutEntry.set('zIndex', 3)
    layoutEntry.set('visible', true)
    doc.getMap<Y.Map<unknown>>(NODES_KEY).set('7', layoutEntry)

    expect(readDocSnapshot(doc).nodes.size).toBe(0)
  })

  it('reads opaque widget arrays positionally', () => {
    const doc = new Y.Doc()
    const m = new Y.Map<unknown>()
    m.set('type', 'Custom')
    m.set('pos', [0, 0])
    m.set(OPAQUE_WIDGETS_KEY, ['a', 'b'])
    doc.getMap<Y.Map<unknown>>(NODES_KEY).set('4', m)

    const snap = readDocSnapshot(doc)
    expect(snap.nodes.get('4')?.widgets).toEqual({ '0': 'a', '1': 'b' })
  })

  it('reflects an applied Yjs update from a second doc (the follower path)', () => {
    const host = new Y.Doc()
    host
      .getMap<Y.Map<unknown>>(NODES_KEY)
      .set('1', nodeMap('LoadImage', [0, 0]))
    const follower = new Y.Doc()
    Y.applyUpdate(follower, Y.encodeStateAsUpdate(host))

    expect(readDocSnapshot(follower).nodes.get('1')?.type).toBe('LoadImage')
  })
})

/**
 * Cross-package parity: the follower must read what the REAL host writes. Rather
 * than hand-build a fixture, mint a doc with the shared package's own `mint()`
 * (the same code the cloud doc-host runs), fork a follower from that snapshot
 * the way a real replica does, and assert the follower's reader projects it. If
 * the upstream doc layout changes, this reddens against the real writer, not a
 * mirror of it.
 */
describe('readDocSnapshot ⇄ comfy-multi-player mint parity', () => {
  it('reads a node minted by the shared package through the snapshot fork', () => {
    const catalog = { types: { LoadImage: { widget_order: ['image'] } } }
    const workflow = {
      nodes: [
        { id: 3, type: 'LoadImage', pos: [12, 34], widgets_values: ['x.png'] }
      ],
      links: []
    }
    const minted = mint(workflow, catalog)
    const follower = new Y.Doc()
    Y.applyUpdate(follower, Y.encodeStateAsUpdate(minted))

    expect(readDocSnapshot(follower).nodes.get('3')).toEqual({
      id: toNodeId('3'),
      type: 'LoadImage',
      pos: [12, 34],
      widgets: { image: 'x.png' }
    })
  })
})
