import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { RenderShape } from '@comfyorg/graph-model/globalEnums'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId, UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  LLink
} from '@/lib/litegraph/src/litegraph'
import { inputLink } from '@/lib/litegraph/src/node/slotLinks'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reorderSubgraphInputs } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import { useLitegraphService } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { hostNodeDef } from '@/platform/nodeApi/v4/defs/__fixtures__/hostNodeTypes'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

const TYPE = 'EditTest/Sampler'

describe('edits and what a load keeps of them', () => {
  let graph: LGraph
  let comfy: Comfy
  let sampler: LGraphNode
  let handle: NodeHandle

  beforeEach(async () => {
    await useLitegraphService().registerNodeDef(
      TYPE,
      hostNodeDef(TYPE, {
        input: {
          required: {
            model: ['MODEL', {}],
            latent: ['LATENT', {}],
            steps: ['INT', { default: 20 }]
          }
        },
        output: ['LATENT', 'IMAGE'],
        output_name: ['LATENT', 'IMAGE']
      })
    )
    graph = new LGraph()
    ;({ comfy } = createComfyApi({ getGraph: () => graph }))
    const created = LiteGraph.createNode(TYPE)
    assert(created)
    sampler = created
    graph.add(sampler)
    const found = comfy.graph.node(String(sampler.id))
    assert(found)
    handle = found
  })

  function reloaded() {
    graph.configure(graph.serialize())
    const node = graph.getNodeById(sampler.id)
    assert(node)
    return node
  }

  const names = (slots: readonly { name: string }[]) =>
    slots.map(({ name }) => name)

  describe('on a node of a backend type', () => {
    it.for([
      ['rename', { name: 'renamed' }],
      ['retype', { type: 'IMAGE' }],
      ['reshape', { shape: 'list' }],
      ['retranslate', { localizedName: 'Modell' }]
    ] as const)(
      'lets a pack %s a slot the type declares, as the host does',
      ([, patch]) => {
        expect(handle.inputs.at(0)?.modify(patch)).toBe(true)
        expect(handle.outputs.at(0)?.modify(patch)).toBe(true)
      }
    )

    it("rebuilds a declared input from the type on a load: a rename comes back as the type's input plus the renamed one", () => {
      handle.inputs.at(0)?.modify({ name: 'renamed' })

      expect(names(reloaded().inputs)).toEqual([
        'model',
        'latent',
        'steps',
        'renamed'
      ])
    })

    it("gives a declared slot its type's type, shape and translated name back on a load", () => {
      handle.outputs.at(0)?.modify({
        type: 'IMAGE',
        shape: 'list',
        localizedName: 'Bild'
      })
      handle.inputs.at(0)?.modify({ type: 'IMAGE', shape: 'list' })

      const node = reloaded()

      expect(node.outputs[0]).toMatchObject({
        type: 'LATENT',
        shape: undefined
      })
      expect(node.outputs[0].localized_name).not.toBe('Bild')
      expect(node.inputs[0]).toMatchObject({ type: 'MODEL', shape: undefined })
    })

    it('gives a declared input its widget back on a load, after a pack made it a plain socket', () => {
      expect(handle.inputs.byName('steps')?.modify({ widget: null })).toBe(true)

      expect(reloaded().inputs[2].widget).toEqual({ name: 'steps' })
    })

    it('removes a declared slot, which a load brings back', () => {
      expect(handle.inputs.remove('model')).toBe(true)
      expect(handle.outputs.remove({ index: 1 })).toBe(true)
      expect(names(sampler.inputs)).toEqual(['latent', 'steps'])

      const node = reloaded()

      expect(names(node.inputs)).toEqual(['model', 'latent', 'steps'])
      expect(node.outputs).toHaveLength(2)
    })

    it("reorders declared slots, which a load puts back in the type's order", () => {
      expect(handle.inputs.reorder(['latent', 'model', 'steps'])).toBe(true)
      expect(names(sampler.inputs)).toEqual(['latent', 'model', 'steps'])

      expect(names(reloaded().inputs)).toEqual(['model', 'latent', 'steps'])
    })

    it("refuses a position for a widget's input, or one the same patch makes a widget's socket", () => {
      const steps = handle.inputs.byName('steps')
      assert(steps)
      sampler.addWidget('number', 'extra', 1, () => {})
      const added = handle.inputs.add('free', 'INT')

      expect(() => steps.modify({ position: { x: 3, y: 4 } })).toThrow(
        /^modify needs a slot that is not a widget's socket/
      )
      expect(() =>
        added?.modify({ widget: 'extra', position: { x: 3, y: 4 } })
      ).toThrow(TypeError)
      expect(steps.modify({ widget: null, position: { x: 3, y: 4 } })).toBe(
        true
      )
      expect(sampler.inputs[2].pos).toEqual([3, 4])
      expect(handle.outputs.at(0)?.modify({ position: { x: 1, y: 1 } })).toBe(
        true
      )
    })

    it('keeps a label, a color and a position on a declared slot across a load', () => {
      handle.inputs.at(0)?.modify({
        label: 'Checkpoint',
        color: '#123',
        position: { x: 1, y: 2 }
      })

      const [model] = reloaded().inputs

      expect(model).toMatchObject({
        name: 'model',
        label: 'Checkpoint',
        color_on: '#123',
        pos: [1, 2]
      })
    })

    it('keeps every edit of a slot a pack added across a load', () => {
      handle.inputs.add('first', 'INT')
      const added = handle.inputs.add('extra', 'INT')
      added?.modify({ name: 'renamed', type: 'FLOAT', label: 'Shown' })
      handle.inputs.reorder(['model', 'latent', 'steps', 'renamed', 'first'])
      const out = handle.outputs.add('more', 'INT')
      out?.modify({ name: 'moreRenamed' })

      const node = reloaded()

      expect(node.inputs[3]).toMatchObject({
        name: 'renamed',
        type: 'FLOAT',
        label: 'Shown'
      })
      expect(names(node.inputs)).toEqual([
        'model',
        'latent',
        'steps',
        'renamed',
        'first'
      ])
      expect(names(node.outputs)).toEqual(['LATENT', 'IMAGE', 'moreRenamed'])
    })

    it('removes a slot a pack added, for good', () => {
      handle.inputs.add('extra', 'INT')

      expect(handle.inputs.remove('extra')).toBe(true)

      expect(names(reloaded().inputs)).toEqual(['model', 'latent', 'steps'])
    })

    it('stops saving the widget values, and a load turns saving back on with every widget at its default', () => {
      const steps = sampler.widgets?.find(({ name }) => name === 'steps')
      assert(steps)
      steps.value = 37

      expect(handle.setSerializeWidgets(false)).toBe(true)
      expect(sampler.serialize_widgets).toBe(false)

      const node = reloaded()

      expect(node.serialize_widgets).toBe(true)
      expect(node.widgets?.find(({ name }) => name === 'steps')?.value).toBe(20)
    })
  })

  describe('on a node of a type a pack defines', () => {
    it('removes a slot the type makes, which a load brings back beside the remaining one', () => {
      const type = 'EditTest/Defined'
      comfy.defs.define({
        type,
        inputs: [
          { name: 'a', type: 'INT' },
          { name: 'b', type: 'INT' }
        ]
      })
      const defined = comfy.graph.add(type)
      assert(defined)

      expect(defined.inputs.remove('a')).toBe(true)
      expect(defined.inputs.names()).toEqual(['b'])

      graph.configure(JSON.parse(JSON.stringify(graph.serialize())))

      expect(defined.inputs.names()).toEqual(['b', 'b'])
    })
  })

  describe('on a node of a type a pack defines with shaped outputs', () => {
    it('draws each output in the shape the definition declares, and a load keeps it', () => {
      const type = 'EditTest/Shaped'
      comfy.defs.define({
        type,
        outputs: [
          { name: 'REPEATER', type: '_NODE_REPEATER_', shape: 'directional' },
          { name: 'many', type: 'INT', shape: 'list' },
          { name: 'own', type: 'INT', shape: 'default' },
          { name: 'plain', type: 'INT' }
        ]
      })
      const defined = comfy.graph.add(type)
      assert(defined)
      const node = graph.getNodeById(toNodeId(defined.id))
      const shapes = () =>
        defined.outputs.all()?.map((slot) => slot.snapshot()?.shape)

      expect(node?.outputs.map(({ shape }) => shape)).toEqual([
        RenderShape.ARROW,
        RenderShape.GRID,
        undefined,
        undefined
      ])
      expect(shapes()).toEqual(['directional', 'list', 'default', 'default'])

      graph.configure(JSON.parse(JSON.stringify(graph.serialize())))

      expect(shapes()).toEqual(['directional', 'list', 'default', 'default'])
    })
  })

  describe('on a Note, a MarkdownNote or a PrimitiveNode', () => {
    it.for(['Note', 'MarkdownNote', 'PrimitiveNode'])(
      'refuses to stop saving the widget values of a %s, whose next load would erase what the user entered',
      (type) => {
        const node = new LGraphNode(type, type)
        node.serialize_widgets = true
        graph.add(node)
        const found = comfy.graph.node(String(node.id))
        assert(found)

        expect(() => found.setSerializeWidgets(false)).toThrow(
          /^setSerializeWidgets needs a node that is not a Note/
        )
        expect(node.serialize_widgets).toBe(true)
        expect(found.setSerializeWidgets(true)).toBe(true)
      }
    )

    it('reads serializeWidgets once, so a getter cannot pass the refusal', () => {
      const note = new LGraphNode('Note', 'Note')
      note.serialize_widgets = true
      graph.add(note)
      const noteHandle = comfy.graph.node(String(note.id))
      assert(noteHandle)
      let reads = 0
      const patch = {
        get serializeWidgets() {
          reads++
          return reads === 1 ? false : true
        }
      }

      expect(() => comfy.edit.updateNode(noteHandle, patch)).toThrow(TypeError)
      expect(reads).toBe(1)
      expect(note.serialize_widgets).toBe(true)
    })

    it('lets any other node stop saving its widget values', () => {
      const plain = new LGraphNode('Plain', 'Notes')
      plain.serialize_widgets = true
      graph.add(plain)

      expect(
        comfy.graph.node(String(plain.id))?.setSerializeWidgets(false)
      ).toBe(true)
      expect(plain.serialize_widgets).toBe(false)
    })
  })

  describe('on a subgraph node', () => {
    let subgraphNode: SubgraphNode
    let subgraphHandle: NodeHandle

    beforeEach(() => {
      onTestFinished(enableSubgraphNodeCreation(graph))
      const inner = new LGraphNode('Inner')
      inner.addInput('first', 'INT')
      inner.addInput('second', 'INT')
      inner.addOutput('out', 'INT')
      graph.add(inner)
      for (const [index, title] of [
        'First source',
        'Second source'
      ].entries()) {
        const source = new LGraphNode(title)
        source.addOutput('value', 'INT')
        graph.add(source)
        source.connect(0, inner, index)
      }
      const sink = new LGraphNode('Sink')
      sink.addInput('value', 'INT')
      graph.add(sink)
      inner.connect(0, sink, 0)
      subgraphNode = graph.convertToSubgraph(new Set([inner])).node
      const found = comfy.graph.node(String(subgraphNode.id))
      assert(found)
      subgraphHandle = found
    })

    function sourceFeeding() {
      return Object.fromEntries(
        subgraphNode.subgraph.inputs.map((input, index) => {
          const link = inputLink(graph, subgraphNode.id, index)
          return [input.name, link && graph.getNodeById(link.origin_id)?.title]
        })
      )
    }

    const fedBySources = { first: 'First source', second: 'Second source' }

    it("keeps each subgraph input fed by its source through the host's own reorder (positive control)", () => {
      reorderSubgraphInputs(subgraphNode.subgraph, [1, 0])

      expect(sourceFeeding()).toEqual(fedBySources)
    })

    it('reorders its inputs through the subgraph, keeping each fed by its source', () => {
      expect(subgraphHandle.inputs.reorder(['second', 'first'])).toBe(true)

      expect(names(subgraphNode.subgraph.inputs)).toEqual(['second', 'first'])
      expect(names(subgraphNode.inputs)).toEqual(['second', 'first'])
      expect(sourceFeeding()).toEqual(fedBySources)
    })

    it('refuses to reorder its inputs while its subgraph is placed again, leaving every instance fed as before', () => {
      const other = LiteGraph.createNode(subgraphNode.type)
      assert(other)
      graph.add(other)
      const feedingId = inputLink(graph, subgraphNode.id, 0)?.origin_id
      assert(feedingId !== undefined)
      const feeding = graph.getNodeById(feedingId)
      assert(feeding)
      feeding.connect(0, other, 0)

      expect(() => subgraphHandle.inputs.reorder(['second', 'first'])).toThrow(
        TypeError
      )
      expect(names(subgraphNode.subgraph.inputs)).toEqual(['first', 'second'])
      expect(inputLink(graph, other.id, 0)?.origin_id).toBe(feeding.id)
      expect(sourceFeeding()).toEqual(fedBySources)
    })

    it('refuses to reorder its inputs while its subgraph is placed inside another subgraph', () => {
      const holder = new LGraphNode('Holder')
      graph.add(holder)
      const outer = graph.convertToSubgraph(new Set([holder])).node
      expect(subgraphHandle.inputs.reorder(['first', 'second'])).toBe(true)
      const nested = LiteGraph.createNode(subgraphNode.type)
      assert(nested)
      outer.subgraph.add(nested)

      expect(() => subgraphHandle.inputs.reorder(['second', 'first'])).toThrow(
        TypeError
      )
      expect(names(subgraphNode.subgraph.inputs)).toEqual(['first', 'second'])
    })

    it('leaves its inputs and the version alone when the order is unchanged', () => {
      const version = graph._version

      expect(subgraphHandle.inputs.reorder(['first', 'second'])).toBe(true)

      expect(names(subgraphNode.subgraph.inputs)).toEqual(['first', 'second'])
      expect(graph._version).toBe(version)
    })

    it('says no and changes nothing when the host cannot reorder its inputs', () => {
      vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
        ok: false,
        error: { code: 'occupied-target', message: 'refused' }
      })

      expect(subgraphHandle.inputs.reorder(['second', 'first'])).toBe(false)
      expect(names(subgraphNode.subgraph.inputs)).toEqual(['first', 'second'])
      expect(sourceFeeding()).toEqual(fedBySources)
    })

    it('leaves the floating links of its inputs at their slot index, as the host does', () => {
      const intoSecond = graph.addFloatingLink(
        new LLink(
          toLinkId(-1),
          'INT',
          UNASSIGNED_NODE_ID,
          -1,
          subgraphNode.id,
          1
        )
      )
      assert(intoSecond)

      expect(subgraphHandle.inputs.reorder(['second', 'first'])).toBe(true)

      expect(intoSecond.target_slot).toBe(1)
    })

    it('refuses to add, remove, change or reorder outputs of its slots', () => {
      const first = subgraphHandle.inputs.byName('first')
      assert(first)

      expect(() => subgraphHandle.inputs.add('third', 'INT')).toThrow(TypeError)
      expect(() => subgraphHandle.outputs.add('more', 'INT')).toThrow(TypeError)
      expect(() => comfy.edit.removeSlot(first)).toThrow(TypeError)
      expect(() => first.modify({ label: 'Shown' })).toThrow(TypeError)
      expect(subgraphNode.outputs).toHaveLength(1)
      expect(() =>
        subgraphHandle.outputs.reorder([subgraphNode.outputs[0].name])
      ).toThrow(TypeError)
      expect(names(subgraphNode.inputs)).toEqual(
        names(subgraphNode.subgraph.inputs)
      )
      expect(sourceFeeding()).toEqual(fedBySources)
    })
  })
})
