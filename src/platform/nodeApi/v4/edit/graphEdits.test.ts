import { assert, beforeEach, describe, expect, it } from 'vitest'

import {
  BaseWidget,
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { EditCore } from '@/platform/nodeApi/v4/edit/edits'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

const TYPE = 'EditTest/Added'

class AddedNode extends LGraphNode {
  static override title = 'Added by type'
  constructor(title?: string) {
    super(title ?? AddedNode.title)
    this.addInput('in', 'INT')
    this.addOutput('out', 'INT')
  }
}

describe('graph edits', () => {
  let graph: LGraph | null
  let comfy: Comfy
  let edit: EditCore
  let host: ComfyApiHost
  let steps: string[]

  beforeEach(() => {
    LiteGraph.registerNodeType(TYPE, AddedNode)
    graph = new LGraph()
    steps = []
    ;({ comfy, host, edit } = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push('after')
      })
    }))
  })

  function shown(): LGraph {
    assert(graph)
    return graph
  }

  describe('add', () => {
    it('adds a node of a registered type to the graph on screen, as one undo step', () => {
      const version = shown()._version

      const handle = comfy.graph.add(TYPE)

      expect(handle?.type).toBe(TYPE)
      expect(handle?.getTitle()).toBe('Added by type')
      expect(shown().nodes).toHaveLength(1)
      expect(handle).toBe(comfy.graph.node(String(shown().nodes[0].id)))
      expect(steps).toEqual(['before', 'after'])
      expect(shown()._version).toBeGreaterThan(version)
    })

    it('places and titles the node before it joins the graph', () => {
      const seen: number[][] = []
      shown().onNodeAdded = (node) => seen.push(Array.from(node.pos))

      const handle = comfy.graph.add(TYPE, {
        title: 'Named',
        position: { x: 120, y: -40 }
      })

      expect(seen).toEqual([[120, -40]])
      expect(handle?.getTitle()).toBe('Named')
      expect(handle?.getPosition()).toEqual({ x: 120, y: -40 })
    })

    it('adds nothing for a type that is not registered', () => {
      shown().add(new LGraphNode('Already there'))

      expect(comfy.graph.add('EditTest/Missing')).toBeUndefined()
      expect(shown().nodes).toHaveLength(1)
      expect(steps).toEqual([])
    })

    it.for([
      ['a type that is not text', 5, undefined],
      ['an init that is not an object', TYPE, 'title'],
      ['an init field addNode does not take', TYPE, { size: [1, 1] }],
      ['a title that is not text', TYPE, { title: 1 }],
      ['a NaN position', TYPE, { position: { x: Number.NaN, y: 0 } }],
      ['an infinite position', TYPE, { position: { x: 0, y: -Infinity } }],
      ['a position that is not an object', TYPE, { position: 3 }]
    ])('refuses %s before adding anything', ([, type, init]) => {
      expectRefusal(
        () => Reflect.apply(comfy.graph.add, undefined, [type, init]),
        'add'
      )
      expect(shown().nodes).toHaveLength(0)
      expect(steps).toEqual([])
    })

    it('adds nothing without a graph on screen, and still refuses what it cannot use', () => {
      graph = null

      expect(comfy.graph.add(TYPE)).toBeUndefined()
      expectRefusal(() => Reflect.apply(comfy.graph.add, undefined, [5]), 'add')
    })
  })

  describe('addNode', () => {
    it('adds to a subgraph that is not on screen', () => {
      const root = shown()
      const subgraph = createTestSubgraph({ rootGraph: root })
      root.subgraphs.set(subgraph.id, subgraph)
      root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
      const [scope] = comfy.graph.subgraphs()

      const handle = edit.addNode(scope, TYPE)

      expect(handle?.graphId).toBe(subgraph.id)
      expect(subgraph.nodes.map((node) => node.type)).toEqual([TYPE])
      expect(root.nodes.some((node) => node.type === TYPE)).toBe(false)
    })

    it('adds nothing to a graph of a document that is no longer open, and still refuses what it cannot use', () => {
      const scope = comfy.graph.root()
      assert(scope)
      host.beginDocument()

      expect(edit.addNode(scope, TYPE)).toBeUndefined()
      expect(shown().nodes).toHaveLength(0)
      expectRefusal(
        () => Reflect.apply(edit.addNode, undefined, [scope, 5]),
        'addNode'
      )
    })

    it.for([
      ['nothing', undefined],
      ['the graph on screen', 'graph'],
      ['a graph id', 'id'],
      ['a look-alike object', { id: 'x', isDeleted: false }]
    ])('refuses %s in place of a graph handle', ([, given]) => {
      const graphArgument =
        given === 'graph' ? comfy.graph : given === 'id' ? shown().id : given

      expect(() =>
        Reflect.apply(edit.addNode, undefined, [graphArgument, TYPE])
      ).toThrow('addNode needs a graph handle')
      expect(shown().nodes).toHaveLength(0)
    })

    it('refuses a node handle in place of a graph handle', () => {
      const node = comfy.graph.add(TYPE)

      expectRefusal(
        () => Reflect.apply(edit.addNode, undefined, [node, TYPE]),
        'addNode'
      )
    })
  })

  describe('batch', () => {
    it('nests each edit inside the one step it opens', () => {
      comfy.graph.batch(() => {
        comfy.graph.add(TYPE)
        comfy.graph.add(TYPE)
      })

      expect(shown().nodes).toHaveLength(2)
      expect(steps).toEqual([
        'before',
        'before',
        'after',
        'before',
        'after',
        'after'
      ])
    })

    it('refuses an async function', () => {
      expectRefusal(() => comfy.graph.batch(async () => {}), 'batch')
    })
  })

  describe('links', () => {
    it('lists the links of the graph on screen as frozen data, in id order', () => {
      const source = new LGraphNode('Source')
      const target = new LGraphNode('Target')
      source.addOutput('out', 'INT')
      source.addOutput('other', 'FLOAT')
      target.addInput('first', 'FLOAT')
      target.addInput('second', 'INT')
      shown().add(source)
      shown().add(target)
      source.connect(0, target, 1)
      source.connect(1, target, 0)
      const saved = shown().serialize()
      shown().configure({ ...saved, links: [...saved.links].reverse() })

      const links = comfy.graph.links()
      const outputs = comfy.graph.node(String(source.id))?.outputs
      const inputs = comfy.graph.node(String(target.id))?.inputs

      const [first, second] = Array.from(shown().links.keys()).sort(
        (a, b) => a - b
      )
      expect(Array.from(shown().links.keys())).toEqual([second, first])
      expect(links).toEqual([
        {
          id: String(first),
          sourceNodeId: String(source.id),
          sourceSlotId: outputs?.at(0)?.id,
          sourceIndex: 0,
          targetNodeId: String(target.id),
          targetSlotId: inputs?.at(1)?.id,
          targetIndex: 1,
          type: 'INT'
        },
        {
          id: String(second),
          sourceNodeId: String(source.id),
          sourceSlotId: outputs?.at(1)?.id,
          sourceIndex: 1,
          targetNodeId: String(target.id),
          targetSlotId: inputs?.at(0)?.id,
          targetIndex: 0,
          type: 'FLOAT'
        }
      ])
      expect(Object.isFrozen(links)).toBe(true)
      expect(links.every((link) => Object.isFrozen(link))).toBe(true)
    })

    it('has no links without a graph on screen', () => {
      graph = null

      expect(comfy.graph.links()).toEqual([])
    })
  })

  describe('version', () => {
    it('changes when an edit changes the graph on screen', () => {
      const before = comfy.graph.version
      const node = comfy.graph.add(TYPE)
      const afterAdd = comfy.graph.version

      node?.setTitle('Changed')

      expect(afterAdd).not.toBe(before)
      expect(comfy.graph.version).not.toBe(afterAdd)
    })

    it('advances when the host adds a node or links two', () => {
      const source = new LGraphNode('Source')
      source.addOutput('out', 'INT')
      const target = new LGraphNode('Target')
      target.addInput('in', 'INT')
      const before = comfy.graph.version

      shown().add(source)
      const afterAdd = comfy.graph.version
      shown().add(target)
      source.connect(0, target, 0)

      expect(afterAdd).not.toBe(before)
      expect(comfy.graph.version).not.toBe(afterAdd)
    })

    it('never reads alike across a restore, so an undo and the redo after it differ', () => {
      const node = comfy.graph.add(TYPE)
      const saved = shown().serialize()
      node?.setTitle('Edited')
      const edited = comfy.graph.version

      shown().configure(saved)
      host.afterHistoryRestore()
      const undone = comfy.graph.version
      node?.setTitle('Edited')
      shown().configure(saved)
      host.afterHistoryRestore()

      expect(new Set([edited, undone, comfy.graph.version]).size).toBe(3)
    })

    it('advances when the host collapses or pins a node', () => {
      const node = new LGraphNode('Changed outside the API')
      shown().add(node)
      const before = comfy.graph.version

      node.collapse()
      const afterCollapse = comfy.graph.version
      node.pin(true)

      expect(afterCollapse).not.toBe(before)
      expect(comfy.graph.version).not.toBe(afterCollapse)
    })

    it('holds still for a move or a color set outside the API', () => {
      const node = new LGraphNode('Changed outside the API')
      shown().add(node)
      const before = comfy.graph.version

      node.pos = [node.pos[0] + 40, node.pos[1]]
      node.color = '#123'

      expect([node.pos[0], node.color]).toEqual([expect.any(Number), '#123'])
      expect(comfy.graph.version).toBe(before)
    })

    it("advances for a widget value the canvas commits, as the user's edit does", () => {
      const node = new LGraphNode('Changed outside the API')
      const widget = node.addWidget('number', 'steps', 1, () => {})
      assert(widget instanceof BaseWidget)
      shown().add(node)
      const before = comfy.graph.version

      widget.setValue(5, { node })

      expect(widget.value).toBe(5)
      expect(comfy.graph.version).not.toBe(before)
    })

    it('advances for an edit to a subgraph that is not on screen', () => {
      const subgraph = createTestSubgraph({ rootGraph: shown() })
      shown().subgraphs.set(subgraph.id, subgraph)
      shown().add(createTestSubgraphNode(subgraph, { parentGraph: shown() }))
      const inner = new LGraphNode('Inner')
      subgraph.add(inner)
      const [scope] = comfy.graph.subgraphs()
      const handle = scope.node(String(inner.id))
      const before = comfy.graph.version

      expect(handle?.setTitle('Renamed off screen')).toBe(true)
      const afterHandleEdit = comfy.graph.version
      subgraph.add(new LGraphNode('Added by the host'))

      expect(afterHandleEdit).not.toBe(before)
      expect(comfy.graph.version).not.toBe(afterHandleEdit)
    })

    it('reads the same whichever graph of the document is on screen', () => {
      const root = new LGraph()
      const subgraph = createTestSubgraph({ rootGraph: root })
      root.subgraphs.set(subgraph.id, subgraph)
      const subgraphNode = createTestSubgraphNode(subgraph, {
        parentGraph: root
      })
      root.add(subgraphNode)
      for (const title of ['One', 'Two', 'Three']) {
        subgraph.add(new LGraphNode(title))
      }
      stubCanvasGetContext()
      const canvas = new LGraphCanvas(document.createElement('canvas'), root, {
        skip_render: true
      })
      const { comfy: onCanvas } = createComfyApi({
        getGraph: () => canvas.graph
      })
      const atRoot = onCanvas.graph.version

      canvas.openSubgraph(subgraph, subgraphNode)
      const inSubgraph = onCanvas.graph.version
      canvas.setGraph(root)

      expect(onCanvas.graph.id).toBe(root.id)
      expect(inSubgraph).toBe(atRoot)
      expect(onCanvas.graph.version).toBe(atRoot)
    })

    it('changes when removing the last node of a subgraph releases the definition, even one whose count offsets the removal', () => {
      function documentWithOnePlacement(subgraphCount: number) {
        const root = new LGraph()
        const subgraph = createTestSubgraph({ rootGraph: root })
        root.subgraphs.set(subgraph.id, subgraph)
        const placement = createTestSubgraphNode(subgraph, {
          parentGraph: root
        })
        root.add(placement)
        subgraph._version = subgraphCount
        const { comfy: onRoot } = createComfyApi({ getGraph: () => root })
        return { root, onRoot, placement: String(placement.id) }
      }
      const probe = documentWithOnePlacement(0)
      const rootBefore = probe.root._version
      probe.onRoot.graph.node(probe.placement)?.remove()
      const offset = probe.root._version - rootBefore
      const { root, onRoot, placement } = documentWithOnePlacement(offset)
      const before = onRoot.graph.version

      expect(onRoot.graph.node(placement)?.remove()).toBe(true)

      expect(root.subgraphs.size).toBe(0)
      expect(onRoot.graph.version).not.toBe(before)
    })

    it('changes when an import clears the graph and builds another in it', () => {
      const node = comfy.graph.add(TYPE)
      node?.setTitle('Before the import')
      const before = comfy.graph.version

      shown().clear()
      for (let added = 0; added < 3; added++) shown().add(new AddedNode())

      expect(comfy.graph.version).not.toBe(before)
    })

    it('is undefined without a graph on screen', () => {
      graph = null

      expect(comfy.graph.version).toBeUndefined()
    })
  })

  it('keeps the graph handle frozen', () => {
    expect(Object.isFrozen(comfy.graph)).toBe(true)
  })
})
