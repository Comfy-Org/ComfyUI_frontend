import { LinkDirection, RenderShape } from '@comfyorg/graph-model/globalEnums'
import { assert, beforeEach, describe, expect, it } from 'vitest'

import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

describe('slot handles', () => {
  let graph: LGraph
  let comfy: Comfy
  let host: ComfyApiHost
  let source: LGraphNode
  let target: LGraphNode
  let sourceHandle: NodeHandle
  let targetHandle: NodeHandle

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({ getGraph: () => graph }))
    source = new LGraphNode('Source')
    source.addOutput('image', 'IMAGE')
    source.addOutput('mask', 'MASK')
    target = new LGraphNode('Target')
    target.addInput('pixels', 'IMAGE')
    target.addInput('mask', 'MASK')
    graph.add(source)
    graph.add(target)
    const sourceFound = comfy.graph.node(String(source.id))
    const targetFound = comfy.graph.node(String(target.id))
    assert(sourceFound && targetFound)
    sourceHandle = sourceFound
    targetHandle = targetFound
  })

  describe('collections', () => {
    it('list a node’s slots in order, by position, name and id', () => {
      const { inputs } = targetHandle
      const pixels = inputs.at(0)
      assert(pixels)

      expect(inputs.length).toBe(2)
      expect(inputs.names()).toEqual(['pixels', 'mask'])
      expect(inputs.all()?.map((slot) => slot.name)).toEqual(['pixels', 'mask'])
      expect([...inputs].map((slot) => slot.name)).toEqual(['pixels', 'mask'])
      expect(inputs.byName('mask')?.index).toBe(1)
      expect(inputs.byId(pixels.id)).toBe(pixels)
      expect(sourceHandle.outputs.names()).toEqual(['image', 'mask'])
    })

    it('give one handle per slot however it is reached', () => {
      const { inputs } = targetHandle

      expect(inputs.at(1)).toBe(inputs.byName('mask'))
      expect(inputs.all()?.[1]).toBe(inputs.at(1))
      expect(comfy.sameEntity(inputs.at(0), inputs.byName('pixels'))).toBe(true)
    })

    it('find nothing past the end, for a name no slot has, or an unknown id', () => {
      const { inputs } = targetHandle

      expect(inputs.at(2)).toBeUndefined()
      expect(inputs.at(-3)).toBeUndefined()
      expect(inputs.byName('missing')).toBeUndefined()
      expect(inputs.byId('slot:none')).toBeUndefined()
    })

    it('find nothing by a name two slots share', () => {
      source.addOutput('image', 'IMAGE')

      expect(sourceHandle.outputs.byName('image')).toBeUndefined()
      expect(sourceHandle.outputs.byName('mask')?.index).toBe(1)
    })

    it('count a negative position back from the end, as widgets do', () => {
      const { inputs } = targetHandle

      expect(inputs.at(-1)).toBe(inputs.at(1))
      expect(inputs.at(-2)).toBe(inputs.at(0))
    })

    it.for([[1.5], ['0'], [Number.NaN]])(
      'refuse a position that is not a whole number: %o',
      ([index]) => {
        expectRefusal(
          () => Reflect.apply(targetHandle.inputs.at, undefined, [index]),
          'at'
        )
      }
    )

    it('refuse a name or id that is not text', () => {
      expectRefusal(
        () => Reflect.apply(targetHandle.inputs.byName, undefined, [0]),
        'byName'
      )
      expectRefusal(
        () => Reflect.apply(targetHandle.inputs.byId, undefined, [{}]),
        'byId'
      )
    })

    it('read as nothing once the node is gone', () => {
      graph.remove(target)
      const { inputs } = targetHandle

      expect(inputs.length).toBeUndefined()
      expect(inputs.all()).toBeUndefined()
      expect(inputs.names()).toBeUndefined()
      expect(inputs.at(0)).toBeUndefined()
      expect(inputs.byName('mask')).toBeUndefined()
      expect([...inputs]).toEqual([])
    })

    it('are frozen, and so is every list they give', () => {
      const { inputs } = targetHandle

      expect(Object.isFrozen(inputs)).toBe(true)
      expect(Object.isFrozen(inputs.all())).toBe(true)
      expect(Object.isFrozen(inputs.names())).toBe(true)
    })
  })

  describe('reads', () => {
    it('read the live slot', () => {
      const input = targetHandle.inputs.at(1)
      assert(input)
      target.inputs[1].label = 'Alpha'

      expect(input).toMatchObject({
        index: 1,
        name: 'mask',
        type: 'MASK',
        label: 'Alpha',
        isConnected: false,
        isWidgetInput: false,
        connectedType: undefined,
        isDeleted: false
      })
      expect(input.link()).toBeUndefined()
      expect(input.source()).toBeUndefined()
    })

    it('read a link into an input and the links out of an output', () => {
      const link = source.connect(0, target, 0)
      assert(link)
      const input = targetHandle.inputs.at(0)
      const output = sourceHandle.outputs.at(0)
      assert(input && output)

      expect(input.isConnected).toBe(true)
      expect(input.connectedType).toBe('IMAGE')
      expect(input.source()).toEqual({
        nodeId: String(source.id),
        outputIndex: 0
      })
      expect(input.link()).toEqual({
        id: String(link.id),
        sourceNodeId: String(source.id),
        sourceSlotId: output.id,
        sourceIndex: 0,
        targetNodeId: String(target.id),
        targetSlotId: input.id,
        targetIndex: 0,
        type: 'IMAGE'
      })
      source.outputs[0].label = 'Picture'
      expect(output).toMatchObject({
        index: 0,
        name: 'image',
        type: 'IMAGE',
        label: 'Picture',
        isConnected: true,
        isDeleted: false
      })
      expect(output.links()).toEqual([input.link()])
      expect(output.targets()).toEqual([
        { nodeId: String(target.id), inputIndex: 0 }
      ])
      expect(Object.isFrozen(output.links())).toBe(true)
      expect(Object.isFrozen(output.targets()?.[0])).toBe(true)
      expect(Object.isFrozen(input.source())).toBe(true)
    })

    it('read the type of the link into an input', () => {
      source.connect(1, target, 1)

      expect(targetHandle.inputs.at(1)?.connectedType).toBe('MASK')
    })

    it('read a type that accepts several names as them joined', () => {
      target.addInput('any', ['IMAGE', 'MASK'])

      expect(targetHandle.inputs.byName('any')?.type).toBe('IMAGE,MASK')
    })

    it('say whether an input is the socket form of a widget', () => {
      target.addInput('seed', 'INT', { widget: { name: 'seed' } })

      expect(targetHandle.inputs.byName('seed')?.isWidgetInput).toBe(true)
    })

    it('snapshot a slot as it is now, frozen', () => {
      const slot = target.inputs[1]
      slot.label = 'Alpha'
      slot.localized_name = 'Maske'
      slot.pos = [3, 4]
      slot.dir = LinkDirection.LEFT
      slot.shape = RenderShape.HollowCircle
      const input = targetHandle.inputs.at(1)

      const snapshot = input?.snapshot()

      expect(snapshot).toEqual({
        id: input?.id,
        index: 1,
        name: 'mask',
        type: 'MASK',
        label: 'Alpha',
        localizedName: 'Maske',
        position: { x: 3, y: 4 },
        direction: 'left',
        shape: 'optional',
        isConnected: false
      })
      expect(Object.isFrozen(snapshot)).toBe(true)
      expect(Object.isFrozen(snapshot?.position)).toBe(true)
    })

    it('snapshot a shape slots do not name as the default', () => {
      source.outputs[0].shape = RenderShape.BOX

      expect(sourceHandle.outputs.at(0)?.snapshot()?.shape).toBe('default')
    })

    it('read the subgraph input a link inside a subgraph comes from', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'number' }]
      })
      subgraph.rootGraph.subgraphs.set(subgraph.id, subgraph)
      const inner = new LGraphNode('Inner')
      inner.addInput('value', 'number')
      subgraph.add(inner)
      subgraph.inputNode.slots[0].connect(inner.inputs[0], inner)
      const inside = createComfyApi({ getGraph: () => subgraph }).comfy
      const value = inside.graph.node(String(inner.id))?.inputs.at(0)

      const link = value?.link()

      expect(link?.sourceNodeId).toBe(String(SUBGRAPH_INPUT_ID))
      expect(link?.sourceSlotId).toEqual(expect.stringMatching(/^slot:/))
      expect(link?.targetSlotId).toBe(value?.id)
      expect(inside.graph.links()[0]?.sourceSlotId).toBe(link?.sourceSlotId)
    })

    it('read the subgraph output a link inside a subgraph goes to', () => {
      const subgraph = createTestSubgraph({
        outputs: [{ name: 'value', type: 'number' }]
      })
      subgraph.rootGraph.subgraphs.set(subgraph.id, subgraph)
      const inner = new LGraphNode('Inner')
      inner.addOutput('value', 'number')
      subgraph.add(inner)
      subgraph.outputNode.slots[0].connect(inner.outputs[0], inner)
      const inside = createComfyApi({ getGraph: () => subgraph }).comfy
      const value = inside.graph.node(String(inner.id))?.outputs.at(0)

      const links = value?.links() ?? []

      expect(links).toHaveLength(1)
      expect(links[0].sourceSlotId).toBe(value?.id)
      expect(links[0].targetSlotId).toEqual(expect.stringMatching(/^slot:/))
    })

    it('read a link whose slots are missing from a malformed workflow without their ids', () => {
      source.connect(0, target, 0)
      target.inputs.length = 0
      source.outputs.length = 0

      expect(comfy.graph.links()[0]).toMatchObject({
        sourceSlotId: undefined,
        targetSlotId: undefined
      })
    })

    it('snapshot the host’s defaults as defaults', () => {
      expect(sourceHandle.outputs.at(0)?.snapshot()).toMatchObject({
        position: undefined,
        direction: undefined,
        shape: 'default',
        isConnected: false
      })
    })
  })

  describe('lifetime', () => {
    it('follows its slot when slots before it are removed', () => {
      const mask = targetHandle.inputs.at(1)

      target.removeInput(0)

      expect(mask?.index).toBe(0)
      expect(mask?.name).toBe('mask')
    })

    function maskInputRemoved() {
      const mask = targetHandle.inputs.at(1)
      assert(mask)
      target.removeInput(1)
      return mask
    }

    function imageOutputOfRemovedNode() {
      const image = sourceHandle.outputs.at(0)
      assert(image)
      graph.remove(source)
      return image
    }

    it.for([
      { name: 'an input whose slot is removed', removed: maskInputRemoved },
      {
        name: 'an output whose node is removed',
        removed: imageOutputOfRemovedNode
      }
    ])(
      'is deleted with its slot, and reads nothing then: $name',
      ({ removed }) => {
        const slot = removed()

        expect(slot.isDeleted).toBe(true)
        expect([
          slot.index,
          slot.name,
          slot.type,
          slot.label,
          slot.isConnected,
          slot.snapshot()
        ]).toStrictEqual([
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        ])
      }
    )

    it('reads no link of a removed input', () => {
      const mask = maskInputRemoved()

      expect(mask.link()).toBeUndefined()
      expect(mask.connectedType).toBeUndefined()
    })

    it('reads no links of an output whose node is removed', () => {
      const image = imageOutputOfRemovedNode()

      expect(image.links()).toBeUndefined()
      expect(image.targets()).toBeUndefined()
    })

    it('does not outlive an undo, which rebuilds the slots', () => {
      const mask = targetHandle.inputs.at(1)
      graph.configure(graph.serialize())
      host.afterHistoryRestore()

      expect(mask?.isDeleted).toBe(true)
      expect(targetHandle.inputs.at(1)).not.toBe(mask)
      expect(targetHandle.inputs.at(1)?.name).toBe('mask')
    })

    it('keeps the handles whose slots are still there across a history restore', () => {
      const mask = targetHandle.inputs.at(1)
      const image = sourceHandle.outputs.at(0)
      const removedInput = targetHandle.inputs.at(0)
      const removedOutput = sourceHandle.outputs.at(1)
      target.removeInput(0)
      source.removeOutput(1)

      host.afterHistoryRestore()

      expect(mask?.isDeleted).toBe(false)
      expect(targetHandle.inputs.at(0)).toBe(mask)
      expect(sourceHandle.outputs.at(0)).toBe(image)
      expect([removedInput?.isDeleted, removedOutput?.isDeleted]).toEqual([
        true,
        true
      ])
    })

    it('retires the slot handles of a node an undo removed', () => {
      const mask = targetHandle.inputs.at(1)
      graph.remove(target)

      host.afterHistoryRestore()

      expect(mask?.isDeleted).toBe(true)
    })

    it('is retired when another document loads', () => {
      const mask = targetHandle.inputs.at(1)

      host.beginDocument()

      expect(mask?.isDeleted).toBe(true)
    })

    it('cannot be changed by a pack', () => {
      expect(Object.isFrozen(targetHandle.inputs.at(0))).toBe(true)
      expect(Object.isFrozen(sourceHandle.outputs.at(0))).toBe(true)
    })
  })
})
