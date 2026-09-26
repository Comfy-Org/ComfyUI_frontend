import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { toRootGraphId } from '@/types/graphScopeId'

import type { GraphOperation } from './graphOperations'
import {
  attachMintPortWiring,
  notifyMintPortsAfterGraphConfigure,
  notifyMintPortsBeforeGraphLoad
} from './mintPortWiring'
import type {
  MintPortWiring,
  MintableGraph,
  MintableLink
} from './mintPortWiring'

const ROOT_ID = 'root-uuid'
type FakeWidgetValues = NonNullable<ISerialisedNode['widgets_values_named']>

/** Save-format shape the wiring reads back through `serialize()`. */
interface FakeGraphNode {
  id: number
  type: string
  pos: [number, number]
  widgets?: { name: string; type: string; serialize?: boolean }[]
  widgets_values_named?: FakeWidgetValues
  serialize(): Pick<
    ISerialisedNode,
    'id' | 'type' | 'pos' | 'widgets_values_named'
  >
}

function fakeNode(
  id: number,
  type: string,
  widgets: FakeWidgetValues = {}
): FakeGraphNode {
  const node: FakeGraphNode = {
    id,
    type,
    pos: [id * 10, 0],
    widgets: Object.keys(widgets).map((name) => ({ name, type: 'combo' })),
    widgets_values_named: { ...widgets },
    serialize() {
      return {
        id: this.id,
        type: this.type,
        pos: this.pos,
        widgets_values_named: { ...this.widgets_values_named }
      }
    }
  }
  return node
}

function link(
  id: number,
  origin: number,
  target: number,
  type = 'IMAGE'
): MintableLink {
  return {
    id,
    origin_id: origin,
    origin_slot: 0,
    target_id: target,
    target_slot: 0,
    type
  }
}

/**
 * QAF-51 / GM-55: the ChangeTracker replays undo/redo through
 * `app.loadGraphData`, which the mint session treats as a teardown and mutes.
 * The doc therefore never learned what undo removed, and the next follower
 * frame re-materialized it. During `_restoringState` the wiring must diff the
 * graph across the load bracket and mint supported node additions/deletions,
 * changed present widget values, and link additions as semantic ops.
 */
describe('attachMintPortWiring undo/redo restore', () => {
  let minted: GraphOperation[]
  let wiring: MintPortWiring
  let restoring: boolean
  let bound: boolean
  let graphNodes: Map<string, FakeGraphNode>
  let graphLinks: Map<number, MintableLink>

  const graph: MintableGraph = {
    id: ROOT_ID,
    rootGraph: { id: ROOT_ID },
    getNodeById: (id) => graphNodes.get(String(id)) ?? null,
    get _nodes() {
      return [...graphNodes.values()]
    },
    links: {
      values: () => graphLinks.values()
    }
  }

  /** Run `mutate` as the ChangeTracker would: inside a graph load bracket. */
  function restoreThrough(mutate: () => void): void {
    notifyMintPortsBeforeGraphLoad()
    mutate()
    notifyMintPortsAfterGraphConfigure()
  }

  function seedFourNodeGraph(): void {
    graphNodes.set('1', fakeNode(1, 'LoadImage', { image: 'a.png' }))
    graphNodes.set('2', fakeNode(2, 'VAEEncode'))
    graphNodes.set('3', fakeNode(3, 'VAEDecode'))
    graphNodes.set('4', fakeNode(4, 'PreviewImage'))
    graphLinks.set(7, link(7, 1, 2))
    graphLinks.set(9, link(9, 3, 4))
  }

  beforeEach(() => {
    minted = []
    restoring = false
    bound = true
    graphNodes = new Map()
    graphLinks = new Map()
    wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      layoutChanges: () => () => {},
      localActorPrefix: 'user-',
      getGraph: () => graph,
      isRestoringState: () => restoring,
      boundRootGraphId: () => toRootGraphId(ROOT_ID)
    })
  })

  afterEach(() => wiring.detach())

  it('mints the undone node deletion with the link it severed', () => {
    seedFourNodeGraph()
    restoring = true

    restoreThrough(() => {
      graphNodes.delete('4')
      graphLinks.delete(9)
    })

    expect(minted).toEqual([
      { op: 'delete_node', node_id: '4', removed_links: [9] }
    ])
  })

  it('mints nothing across an ordinary (non-undo) graph load', () => {
    seedFourNodeGraph()
    restoring = false

    restoreThrough(() => {
      graphNodes.delete('4')
      graphLinks.delete(9)
    })

    expect(minted).toEqual([])
  })

  it('mints nothing when no doc is bound', () => {
    seedFourNodeGraph()
    restoring = true
    bound = false

    restoreThrough(() => graphNodes.delete('4'))

    expect(minted).toEqual([])
  })

  it('mints the redone node as add_node followed by its connect', () => {
    seedFourNodeGraph()
    graphNodes.delete('4')
    graphLinks.delete(9)
    restoring = true

    restoreThrough(() => {
      graphNodes.set('4', fakeNode(4, 'PreviewImage'))
      graphLinks.set(9, link(9, 3, 4))
    })

    expect(minted.map((operation) => operation.op)).toEqual([
      'add_node',
      'connect'
    ])
    expect(minted[0]).toMatchObject({
      op: 'add_node',
      node_id: '4',
      class_type: 'PreviewImage',
      pos: [40, 0]
    })
    expect(minted[1]).toEqual({
      op: 'connect',
      link_id: 9,
      from_node: 3,
      from_slot: 0,
      to_node: 4,
      to_slot: 0,
      link_type: 'IMAGE'
    })
  })

  it('mints a set_widget for a value the restore changed on a surviving node', () => {
    seedFourNodeGraph()
    restoring = true

    restoreThrough(() => {
      graphNodes.get('1')!.widgets_values_named = { image: 'b.png' }
    })

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: '1',
        widget: 'image',
        value: 'b.png',
        old: 'a.png'
      }
    ])
  })

  it('does not mint a delete for a still-present node whose serialize() throws after the restore', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    seedFourNodeGraph()
    restoring = true

    restoreThrough(() => {
      graphNodes.get('4')!.serialize = () => {
        throw new Error('custom node serialize failed')
      }
    })

    expect(minted).toEqual([])
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('could not serialize every present node'),
      ['4']
    )
    error.mockRestore()
  })

  it('does not mint an add for a node that only became serializable during the restore', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    seedFourNodeGraph()
    const restored = fakeNode(4, 'PreviewImage')
    graphNodes.get('4')!.serialize = () => {
      throw new Error('custom node serialize failed')
    }
    restoring = true

    restoreThrough(() => graphNodes.set('4', restored))

    expect(minted).toEqual([])
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('could not serialize every present node'),
      ['4']
    )
    error.mockRestore()
  })

  it('suppresses the whole diff, including real changes, while a snapshot is incomplete', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    seedFourNodeGraph()
    restoring = true

    restoreThrough(() => {
      graphNodes.get('1')!.widgets_values_named = { image: 'b.png' }
      graphNodes.get('4')!.serialize = () => {
        throw new Error('custom node serialize failed')
      }
    })

    expect(minted).toEqual([])
    error.mockRestore()
  })

  it('surfaces a link removed without its node instead of dropping it silently', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    seedFourNodeGraph()
    restoring = true

    restoreThrough(() => graphLinks.delete(9))

    expect(minted).toEqual([])
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('removed link without its node'),
      '9'
    )
    error.mockRestore()
  })
})
