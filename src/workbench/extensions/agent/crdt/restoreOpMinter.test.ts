import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import type { GraphOperation } from './graphOperations'
import {
  attachRestoreOpMinter,
  notifyRestoreMintersAfterGraphConfigure,
  notifyRestoreMintersBeforeGraphLoad,
  notifyRestoreMintersGraphLoadError
} from './restoreOpMinter'
import type { RestoreOpMinter } from './restoreOpMinter'

class TestSource extends LGraphNode {
  constructor() {
    super('Test Source')
    this.addWidget('text', 'image', 'a.png', () => {})
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestSink extends LGraphNode {
  constructor() {
    super('Test Sink')
    this.addInput('image', 'IMAGE')
  }
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestSink', TestSink)
})

/**
 * QAF-51: the ChangeTracker replays undo/redo through `app.loadGraphData`,
 * which litegraph runs under the `load` intent source, so the doc never learns
 * what the undo removed and the next remote frame re-materializes it. During
 * `_restoringState` the graph is diffed across the load bracket and the
 * supported subset is minted as semantic ops.
 */
describe('attachRestoreOpMinter', () => {
  let graph: LGraph
  let minted: GraphOperation[]
  let minter: RestoreOpMinter
  let restoring: boolean
  let bound: boolean
  let source: TestSource
  let sink: TestSink

  /** Run `mutate` as the ChangeTracker would: inside a graph load bracket. */
  function restoreThrough(mutate: () => void): void {
    notifyRestoreMintersBeforeGraphLoad()
    mutate()
    notifyRestoreMintersAfterGraphConfigure()
  }

  beforeEach(() => {
    graph = new LGraph()
    minted = []
    restoring = true
    bound = true
    source = new TestSource()
    sink = new TestSink()
    graph.add(source)
    graph.add(sink)
    sink.pos = [40, 0]
    source.connect(0, sink, 0)
    minter = attachRestoreOpMinter({
      isEnabled: () => true,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => graph,
      isRestoringState: () => restoring
    })
  })

  afterEach(() => minter.detach())

  it('mints the undone node deletion with the link it severed', () => {
    const linkId = sink.inputs[0].link
    restoreThrough(() => graph.remove(sink))

    expect(minted).toEqual([
      { op: 'delete_node', node_id: String(sink.id), removed_links: [linkId] }
    ])
  })

  it('mints the redone node as add_node followed by its connect', () => {
    graph.remove(sink)
    const restored = new TestSink()
    restored.id = sink.id

    restoreThrough(() => {
      graph.add(restored)
      restored.pos = [40, 0]
      source.connect(0, restored, 0)
    })

    expect(minted).toEqual([
      {
        op: 'add_node',
        node_id: String(sink.id),
        class_type: 'TestSink',
        pos: [40, 0],
        node: expect.objectContaining({ type: 'TestSink' })
      },
      {
        op: 'connect',
        link_id: restored.inputs[0].link,
        from_node: source.id,
        from_slot: 0,
        to_node: sink.id,
        to_slot: 0,
        link_type: 'IMAGE'
      }
    ])
  })

  it('mints a set_widget for a value the restore changed on a surviving node', () => {
    restoreThrough(() => {
      source.widgets![0].value = 'b.png'
    })

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: String(source.id),
        widget: 'image',
        value: 'b.png',
        old: 'a.png'
      }
    ])
  })

  it.for([
    {
      reason: 'an ordinary (non-undo) graph load',
      restoring: false,
      bound: true
    },
    { reason: 'no doc is bound', restoring: true, bound: false }
  ])('mints nothing across $reason', (scenario) => {
    restoring = scenario.restoring
    bound = scenario.bound

    restoreThrough(() => graph.remove(sink))

    expect(minted).toEqual([])
  })

  it('mints nothing when the load failed before configure', () => {
    notifyRestoreMintersBeforeGraphLoad()
    graph.remove(sink)
    notifyRestoreMintersGraphLoadError()
    notifyRestoreMintersAfterGraphConfigure()

    expect(minted).toEqual([])
  })

  it('mints nothing after detach', () => {
    minter.detach()

    restoreThrough(() => graph.remove(sink))

    expect(minted).toEqual([])
  })

  it('skips the whole diff, including real changes, when a present node cannot serialize', () => {
    restoreThrough(() => {
      source.widgets![0].value = 'b.png'
      sink.serialize = () => {
        throw new Error('custom node serialize failed')
      }
    })

    expect(minted).toEqual([])
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('could not serialize every present node'),
      [String(sink.id)]
    )
  })

  it('surfaces a link removed without its node instead of dropping it silently', () => {
    const linkId = sink.inputs[0].link

    restoreThrough(() => sink.disconnectInput(0))

    expect(minted).toEqual([])
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('removed link without its node'),
      String(linkId)
    )
  })
})
