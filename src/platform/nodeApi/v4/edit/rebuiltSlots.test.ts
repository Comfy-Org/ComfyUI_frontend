import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
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

describe('edits a load would not keep', () => {
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
    it('rebuilds a declared slot from the type on a load (the host behaviour the refusals follow)', () => {
      sampler.inputs[0].name = 'renamed'
      sampler.outputs[0].type = 'IMAGE'

      const node = reloaded()

      expect(names(node.inputs)).toEqual([
        'model',
        'latent',
        'steps',
        'renamed'
      ])
      expect(node.outputs[0].type).toBe('LATENT')
    })

    it.for([
      ['rename', { name: 'renamed' }],
      ['retype', { type: 'IMAGE' }],
      ['reshape', { shape: 'list' }],
      ['retranslate', { localizedName: 'Modell' }]
    ] as const)(
      'refuses to %s a declared input or output, changing nothing',
      ([, patch]) => {
        const before = JSON.stringify(graph.serialize())

        expect(() => handle.inputs.at(0)?.modify(patch)).toThrow(TypeError)
        expect(() => handle.outputs.at(0)?.modify(patch)).toThrow(TypeError)
        expect(JSON.stringify(graph.serialize())).toBe(before)
      }
    )

    it('refuses to rename the declared input of a widget, or make a declared input the socket of another', () => {
      expect(() =>
        handle.inputs.byName('steps')?.modify({ name: 'count' })
      ).toThrow(TypeError)
      expect(() => handle.inputs.at(0)?.modify({ widget: 'steps' })).toThrow(
        TypeError
      )
    })

    it('treats a node whose type carries other data as a type it does not rebuild', () => {
      class Annotated extends LGraphNode {
        static override nodeData = { name: 'Annotated' }
      }
      const node = new Annotated('Annotated')
      node.addInput('value', 'INT')
      graph.add(node)

      expect(
        comfy.graph
          .node(String(node.id))
          ?.inputs.at(0)
          ?.modify({ name: 'renamed' })
      ).toBe(true)
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

    it('refuses to remove a declared slot, which a load brings back', () => {
      expect(() => handle.inputs.remove('model')).toThrow(TypeError)
      expect(() => handle.outputs.remove({ index: 1 })).toThrow(TypeError)
      expect(() => handle.inputs.remove('steps')).toThrow(TypeError)
      expect(names(sampler.inputs)).toEqual(['model', 'latent', 'steps'])
      expect(sampler.outputs).toHaveLength(2)
    })

    it('refuses a reorder that moves a declared slot, and keeps one that moves only added slots', () => {
      handle.inputs.add('first', 'INT')
      handle.inputs.add('second', 'INT')
      handle.outputs.add('extra', 'INT')

      expect(() =>
        handle.inputs.reorder(['latent', 'model', 'steps', 'first', 'second'])
      ).toThrow(TypeError)
      expect(() =>
        handle.inputs.reorder(['model', 'latent', 'first', 'steps', 'second'])
      ).toThrow(TypeError)
      expect(() =>
        handle.outputs.reorder(['IMAGE', 'LATENT', 'extra'])
      ).toThrow(TypeError)
      expect(
        handle.inputs.reorder(['model', 'latent', 'steps', 'second', 'first'])
      ).toBe(true)

      expect(names(reloaded().inputs)).toEqual([
        'model',
        'latent',
        'steps',
        'second',
        'first'
      ])
    })

    it('keeps every edit of a slot a pack added across a load', () => {
      const added = handle.inputs.add('extra', 'INT')
      added?.modify({ name: 'renamed', type: 'FLOAT', label: 'Shown' })
      const out = handle.outputs.add('more', 'INT')
      out?.modify({ name: 'moreRenamed' })

      const node = reloaded()

      expect(node.inputs[3]).toMatchObject({
        name: 'renamed',
        type: 'FLOAT',
        label: 'Shown'
      })
      expect(names(node.outputs)).toEqual(['LATENT', 'IMAGE', 'moreRenamed'])
    })

    it('removes a slot a pack added, for good', () => {
      handle.inputs.add('extra', 'INT')

      expect(handle.inputs.remove('extra')).toBe(true)

      expect(names(reloaded().inputs)).toEqual(['model', 'latent', 'steps'])
    })

    it('refuses to stop saving the widget values, which a load would lose', () => {
      expect(() => handle.setSerializeWidgets(false)).toThrow(TypeError)
      expect(sampler.serialize_widgets).toBe(true)
      expect(handle.setSerializeWidgets(true)).toBe(true)
    })

    it('lets a node of a type the backend does not declare stop saving its widget values', () => {
      const plain = new LGraphNode('Plain')
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
      reorderSubgraphInputs(subgraphNode, [1, 0])

      expect(sourceFeeding()).toEqual(fedBySources)
    })

    it('reorders its inputs through the subgraph, keeping each fed by its source', () => {
      expect(subgraphHandle.inputs.reorder(['second', 'first'])).toBe(true)

      expect(names(subgraphNode.subgraph.inputs)).toEqual(['second', 'first'])
      expect(names(subgraphNode.inputs)).toEqual(['second', 'first'])
      expect(sourceFeeding()).toEqual(fedBySources)
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
