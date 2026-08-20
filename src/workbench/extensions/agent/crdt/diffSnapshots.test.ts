import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import { diffSnapshots } from './diffSnapshots'
import type { DocSnapshot } from './docSchema'
import type { GraphMutation, LinkSpec, NodeSpec } from './graphMutations'

interface NodeDesc {
  id: string
  type: string
  pos: [number, number]
  widgets: Record<string, unknown>
}
interface LinkDesc {
  id: string
  originId: string
  originSlot: number
  targetId: string
  targetSlot: number
}

function snapshot(nodes: NodeDesc[], links: LinkDesc[] = []): DocSnapshot {
  const nodeMap = new Map<string, NodeSpec>()
  for (const n of nodes) {
    nodeMap.set(n.id, {
      id: toNodeId(n.id),
      type: n.type,
      pos: n.pos,
      widgets: n.widgets
    })
  }
  const linkMap = new Map<string, LinkSpec>()
  for (const l of links) {
    linkMap.set(l.id, {
      id: l.id,
      originId: toNodeId(l.originId),
      originSlot: l.originSlot,
      targetId: toNodeId(l.targetId),
      targetSlot: l.targetSlot
    })
  }
  return { nodes: nodeMap, links: linkMap }
}

/** Mirror of the mutator's semantics on plain data — the model under test. */
function applyToModel(
  base: DocSnapshot,
  mutations: GraphMutation[]
): DocSnapshot {
  const nodes = new Map(
    [...base.nodes].map(([k, v]) => [k, { ...v, widgets: { ...v.widgets } }])
  )
  const links = new Map(base.links)
  for (const m of mutations) {
    switch (m.kind) {
      case 'add_node':
        nodes.set(String(m.node.id), {
          ...m.node,
          widgets: { ...m.node.widgets }
        })
        break
      case 'remove_node':
        nodes.delete(String(m.id))
        break
      case 'move_node': {
        const n = nodes.get(String(m.id))
        if (n) nodes.set(String(m.id), { ...n, pos: m.pos })
        break
      }
      case 'set_widget': {
        const n = nodes.get(String(m.id))
        if (n)
          nodes.set(String(m.id), {
            ...n,
            widgets: { ...n.widgets, [m.name]: m.value }
          })
        break
      }
      case 'connect':
        links.set(m.link.id, m.link)
        break
      case 'disconnect':
        links.delete(m.id)
        break
    }
  }
  return { nodes, links }
}

function normalize(s: DocSnapshot) {
  return {
    nodes: [...s.nodes.entries()]
      .map(([k, v]) => [k, { type: v.type, pos: v.pos, widgets: v.widgets }])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
    links: [...s.links.entries()].sort(([a], [b]) =>
      String(a).localeCompare(String(b))
    )
  }
}

describe('diffSnapshots (unit)', () => {
  it('emits no mutations for identical snapshots', () => {
    const a = snapshot([
      { id: '1', type: 'LoadImage', pos: [0, 0], widgets: {} }
    ])
    expect(diffSnapshots(a, a)).toEqual([])
  })

  it('adds a new node', () => {
    const before = snapshot([])
    const after = snapshot([
      { id: '7', type: 'LoadVideo', pos: [10, 20], widgets: { fps: 24 } }
    ])
    expect(diffSnapshots(before, after)).toEqual([
      {
        kind: 'add_node',
        node: {
          id: toNodeId('7'),
          type: 'LoadVideo',
          pos: [10, 20],
          widgets: { fps: 24 }
        }
      }
    ])
  })

  it('removes a node and its inbound link, ordering disconnect before removal', () => {
    const before = snapshot(
      [
        { id: '1', type: 'A', pos: [0, 0], widgets: {} },
        { id: '2', type: 'B', pos: [0, 0], widgets: {} }
      ],
      [{ id: 'l1', originId: '1', originSlot: 0, targetId: '2', targetSlot: 0 }]
    )
    const after = snapshot([{ id: '1', type: 'A', pos: [0, 0], widgets: {} }])
    const muts = diffSnapshots(before, after)
    const kinds = muts.map((m) => m.kind)
    expect(kinds.indexOf('disconnect')).toBeLessThan(
      kinds.indexOf('remove_node')
    )
  })

  it('emits move and set_widget for a surviving node', () => {
    const before = snapshot([
      { id: '1', type: 'A', pos: [0, 0], widgets: { seed: 1 } }
    ])
    const after = snapshot([
      { id: '1', type: 'A', pos: [5, 6], widgets: { seed: 2 } }
    ])
    expect(diffSnapshots(before, after)).toEqual([
      { kind: 'move_node', id: toNodeId('1'), pos: [5, 6] },
      { kind: 'set_widget', id: toNodeId('1'), name: 'seed', value: 2 }
    ])
  })

  it('re-emits a connect when a link is rewired to a new slot', () => {
    const before = snapshot(
      [
        { id: '1', type: 'A', pos: [0, 0], widgets: {} },
        { id: '2', type: 'B', pos: [0, 0], widgets: {} }
      ],
      [{ id: 'l1', originId: '1', originSlot: 0, targetId: '2', targetSlot: 0 }]
    )
    const after = snapshot(
      [
        { id: '1', type: 'A', pos: [0, 0], widgets: {} },
        { id: '2', type: 'B', pos: [0, 0], widgets: {} }
      ],
      [{ id: 'l1', originId: '1', originSlot: 0, targetId: '2', targetSlot: 1 }]
    )
    expect(diffSnapshots(before, after)).toEqual([
      { kind: 'disconnect', id: 'l1', targetId: toNodeId('2'), targetSlot: 0 },
      {
        kind: 'connect',
        link: {
          id: 'l1',
          originId: toNodeId('1'),
          originSlot: 0,
          targetId: toNodeId('2'),
          targetSlot: 1
        }
      }
    ])
  })
})

// ---- property tests: the follower's convergence guarantee ------------------

// Real ComfyUI invariants the generator must respect, otherwise it exercises
// impossible states the diff intentionally does not model:
//   - a node id keeps a FIXED type for its lifetime (no id reuse with a new
//     type; a replacement is a delete + add of a new id), and
//   - a node type has a FIXED widget-name set; only widget VALUES change.
// So type and widget keys are pinned per id; only pos and widget values vary.
const NODE_SCHEMA: Record<string, { type: string; widgetKeys: string[] }> = {
  '1': { type: 'LoadImage', widgetKeys: [] },
  '2': { type: 'LoadVideo', widgetKeys: ['fps'] },
  '3': { type: 'KSampler', widgetKeys: ['seed', 'steps'] },
  '4': { type: 'SaveImage', widgetKeys: ['filename'] },
  '5': { type: 'VAEDecode', widgetKeys: ['tile'] }
}

const arbNode = (id: string): fc.Arbitrary<NodeDesc> => {
  const schema = NODE_SCHEMA[id]
  const widgetArb =
    schema.widgetKeys.length === 0
      ? fc.constant<Record<string, unknown>>({})
      : (fc
          .tuple(
            ...schema.widgetKeys.map(() => fc.oneof(fc.integer(), fc.string()))
          )
          .map((values) =>
            Object.fromEntries(
              schema.widgetKeys.map((key, i) => [key, values[i]])
            )
          ) as fc.Arbitrary<Record<string, unknown>>)
  return fc.record({
    id: fc.constant(id),
    type: fc.constant(schema.type),
    pos: fc.tuple(
      fc.integer({ min: -500, max: 500 }),
      fc.integer({ min: -500, max: 500 })
    ) as fc.Arbitrary<[number, number]>,
    widgets: widgetArb
  })
}

const arbSnapshot: fc.Arbitrary<DocSnapshot> = fc
  .uniqueArray(fc.constantFrom('1', '2', '3', '4', '5'), { minLength: 0 })
  .chain((ids) => {
    const nodes = ids.map((id) => arbNode(id))
    return fc.tuple(...nodes).chain((nodeDescs) => {
      const linkArb =
        ids.length < 2
          ? fc.constant<LinkDesc[]>([])
          : fc.uniqueArray(
              fc.record({
                id: fc.constant(''),
                originId: fc.constantFrom(...ids),
                originSlot: fc.integer({ min: 0, max: 3 }),
                targetId: fc.constantFrom(...ids),
                targetSlot: fc.integer({ min: 0, max: 3 })
              }),
              { maxLength: 4, selector: (l) => `${l.targetId}:${l.targetSlot}` }
            )
      return linkArb.map((links) =>
        snapshot(
          nodeDescs,
          links.map((l, i) => ({ ...l, id: `l${String(i)}` }))
        )
      )
    })
  })

describe('diffSnapshots (property)', () => {
  it('applying diff(a, b) to a transforms a into b', () => {
    fc.assert(
      fc.property(arbSnapshot, arbSnapshot, (a, b) => {
        const result = applyToModel(a, diffSnapshots(a, b))
        expect(normalize(result)).toEqual(normalize(b))
      })
    )
  })

  it('is a no-op on identical snapshots', () => {
    fc.assert(
      fc.property(arbSnapshot, (a) => {
        expect(diffSnapshots(a, a)).toEqual([])
      })
    )
  })

  it('converges: re-diffing after applying yields nothing', () => {
    fc.assert(
      fc.property(arbSnapshot, arbSnapshot, (a, b) => {
        const applied = applyToModel(a, diffSnapshots(a, b))
        expect(diffSnapshots(applied, b)).toEqual([])
      })
    )
  })
})
