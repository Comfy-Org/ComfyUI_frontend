import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useLinkStore } from '@/stores/linkStore'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { EditCore } from '@/platform/nodeApi/v4/edit/edits'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

describe('link edits', () => {
  let graph: LGraph
  let comfy: Comfy
  let edit: EditCore
  let host: ComfyApiHost
  let steps: string[]
  let source: LGraphNode
  let target: LGraphNode
  let other: LGraphNode
  let sourceHandle: NodeHandle
  let targetHandle: NodeHandle
  let otherHandle: NodeHandle

  function handleOf(node: LGraphNode) {
    const handle = comfy.graph.node(String(node.id))
    assert(handle)
    return handle
  }

  beforeEach(() => {
    graph = new LGraph()
    steps = []
    ;({ comfy, host, edit } = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push('after')
      })
    }))
    source = new LGraphNode('Source')
    source.addOutput('image', 'IMAGE')
    source.addOutput('copy', 'IMAGE')
    source.addOutput('mask', 'MASK')
    target = new LGraphNode('Target')
    target.addInput('pixels', 'IMAGE')
    target.addInput('mask', 'MASK')
    other = new LGraphNode('Other')
    other.addInput('pixels', 'IMAGE')
    for (const node of [source, target, other]) graph.add(node)
    sourceHandle = handleOf(source)
    targetHandle = handleOf(target)
    otherHandle = handleOf(other)
  })

  const out = (name: string) => {
    const slot = sourceHandle.outputs.byName(name)
    assert(slot)
    return slot
  }
  const into = (node: NodeHandle, name: string) => {
    const slot = node.inputs.byName(name)
    assert(slot)
    return slot
  }

  describe('connect', () => {
    it('links an output to an input as one undo step and gives the link', () => {
      const version = graph._version

      const link = edit.connect(out('image'), into(targetHandle, 'pixels'))

      expect(link).toMatchObject({
        sourceNodeId: String(source.id),
        sourceIndex: 0,
        targetNodeId: String(target.id),
        targetIndex: 0,
        type: 'IMAGE'
      })
      expect(into(targetHandle, 'pixels').link()).toEqual(link)
      expect(steps).toEqual(['before', 'after'])
      expect(graph._version).toBeGreaterThan(version)
    })

    it('gives nothing when the host refuses the link', () => {
      expect(
        edit.connect(out('mask'), into(targetHandle, 'pixels'))
      ).toBeUndefined()
      expect(target.isInputConnected(0)).toBe(false)
    })

    it('connectTo finds the input by name, id or position on the node with that id', () => {
      const mask = into(targetHandle, 'mask')

      expect(out('image').connectTo(String(target.id), 'pixels')).toBeDefined()
      expect(out('mask').connectTo(String(target.id), mask.id)).toBeDefined()
      expect(
        out('copy').connectTo(String(other.id), { index: 0 })
      ).toBeDefined()

      expect([target.isInputConnected(0), target.isInputConnected(1)]).toEqual([
        true,
        true
      ])
      expect(other.isInputConnected(0)).toBe(true)
    })

    it('connectTo gives nothing for a node or input that is not there', () => {
      expect(out('image').connectTo('999', 'pixels')).toBeUndefined()
      expect(
        out('image').connectTo(String(target.id), 'missing')
      ).toBeUndefined()
      expect(steps).toEqual([])
    })

    it('connectTo looks the node up in the output’s own graph, not the one on screen', () => {
      const elsewhere = new LGraph()
      const lookalike = new LGraphNode('Look-alike')
      lookalike.addInput('pixels', 'IMAGE')
      lookalike.id = target.id
      elsewhere.add(lookalike)
      const image = out('image')
      graph = elsewhere

      expect(image.connectTo(String(target.id), 'pixels')).toBeDefined()
      expect(target.isInputConnected(0)).toBe(true)
      expect(lookalike.isInputConnected(0)).toBe(false)
    })

    it.for([
      ['an input in place of the output', 'swap'],
      ['a node in place of a slot', 'node'],
      ['nothing', 'nothing']
    ])('refuses %s', ([, how]) => {
      const args =
        how === 'swap'
          ? [into(targetHandle, 'pixels'), out('image')]
          : how === 'node'
            ? [sourceHandle, into(targetHandle, 'pixels')]
            : [out('image'), undefined]

      expect(() => Reflect.apply(edit.connect, undefined, args)).toThrow(
        TypeError
      )
      expect(steps).toEqual([])
    })

    it('refuses connectTo with a node id or input reference it cannot use', () => {
      expect(() =>
        Reflect.apply(out('image').connectTo, undefined, [7, 'pixels'])
      ).toThrow(TypeError)
      expect(() =>
        Reflect.apply(out('image').connectTo, undefined, [String(target.id), 0])
      ).toThrow(TypeError)
    })

    it('refuses to link slots of two graphs', () => {
      onTestFinished(enableSubgraphNodeCreation(graph))
      const inner = new LGraphNode('Inner')
      inner.addInput('pixels', 'IMAGE')
      graph.add(inner)
      graph.convertToSubgraph(new Set([inner]))
      const [innerHandle] = comfy.graph
        .queryNodes({ scope: 'root-and-subgraphs' })
        .filter((node) => node.graphId !== graph.id)
      const innerInput = innerHandle.inputs.at(0)
      assert(innerInput)

      expect(() => edit.connect(out('image'), innerInput)).toThrow(TypeError)
    })

    it('gives nothing for a slot that is gone', () => {
      const pixels = into(targetHandle, 'pixels')
      graph.remove(target)

      expect(edit.connect(out('image'), pixels)).toBeUndefined()
      expect(
        out('image').connectTo(String(target.id), 'pixels')
      ).toBeUndefined()
    })

    it('gives nothing from an output of a document that is no longer open', () => {
      const image = out('image')
      host.beginDocument()

      expect(image.connectTo(String(target.id), 'pixels')).toBeUndefined()
      expect(target.isInputConnected(0)).toBe(false)
    })
  })

  describe('disconnect', () => {
    beforeEach(() => {
      source.connect(0, target, 0)
      source.connect(0, other, 0)
      steps.length = 0
    })

    it('removes an input’s link as one undo step', () => {
      const version = graph._version

      expect(into(targetHandle, 'pixels').disconnect()).toBe(true)

      expect(target.isInputConnected(0)).toBe(false)
      expect(other.isInputConnected(0)).toBe(true)
      expect(steps).toEqual(['before', 'after'])
      expect(graph._version).toBeGreaterThan(version)
    })

    it('removes an output’s link to one node, or all of them', () => {
      expect(out('image').disconnect(String(other.id))).toBe(true)
      expect([target.isInputConnected(0), other.isInputConnected(0)]).toEqual([
        true,
        false
      ])

      expect(edit.disconnect(out('image'))).toBe(true)
      expect(target.isInputConnected(0)).toBe(false)
    })

    it('removes every link of an output through its handle', () => {
      expect(out('image').disconnect()).toBe(true)

      expect([target.isInputConnected(0), other.isInputConnected(0)]).toEqual([
        false,
        false
      ])
    })

    it('removes nothing for a target node that is not there', () => {
      expect(out('image').disconnect('999')).toBe(false)
      expect([target.isInputConnected(0), other.isInputConnected(0)]).toEqual([
        true,
        true
      ])
    })

    it('removes nothing for a slot or target that is gone', () => {
      const pixels = into(targetHandle, 'pixels')
      graph.remove(other)

      expect(edit.disconnect(out('image'), otherHandle)).toBe(false)
      graph.remove(target)
      expect(pixels.disconnect()).toBe(false)
    })

    it('says no for an input with no link', () => {
      expect(into(targetHandle, 'mask').disconnect()).toBe(false)
    })

    it.for([
      [
        'a target for an input',
        () => [into(targetHandle, 'pixels'), otherHandle]
      ],
      [
        'a target that is not a node handle',
        () => [out('image'), String(other.id)]
      ],
      ['an id that is not text', () => [out('image')]]
    ] as const)('refuses %s', ([name, args]) => {
      const call =
        name === 'an id that is not text'
          ? () => Reflect.apply(out('image').disconnect, undefined, [5])
          : () => Reflect.apply(edit.disconnect, undefined, [...args()])

      expect(call).toThrow(TypeError)
      expect([target.isInputConnected(0), other.isInputConnected(0)]).toEqual([
        true,
        true
      ])
    })

    it('refuses a target in another graph', () => {
      onTestFinished(enableSubgraphNodeCreation(graph))
      const inner = new LGraphNode('Inner')
      graph.add(inner)
      graph.convertToSubgraph(new Set([inner]))
      const [innerHandle] = comfy.graph
        .queryNodes({ scope: 'root-and-subgraphs' })
        .filter((node) => node.graphId !== graph.id)

      expect(() => edit.disconnect(out('image'), innerHandle)).toThrow(
        TypeError
      )
    })
  })

  describe('moveLinks', () => {
    it('moves every link of an output to another, keeping their ids, as one undo step', () => {
      const first = source.connect(0, target, 0)
      const second = source.connect(0, other, 0)
      steps.length = 0

      const moved = out('image').moveLinksTo('copy')

      expect(moved?.map(({ id }) => id)).toEqual([
        String(first?.id),
        String(second?.id)
      ])
      expect(moved?.every(({ sourceIndex }) => sourceIndex === 1)).toBe(true)
      expect(out('image').isConnected).toBe(false)
      expect(
        out('copy')
          .links()
          ?.map(({ id }) => id)
      ).toEqual([String(first?.id), String(second?.id)])
      expect(Object.isFrozen(moved)).toBe(true)
      expect(steps).toEqual(['before', 'after'])
    })

    it('does not check the types again', () => {
      source.connect(0, target, 0)

      expect(out('image').moveLinksTo('mask')).toHaveLength(1)
      expect(target.getInputLink(0)?.origin_slot).toBe(2)
    })

    it('gives nothing for a target output that is not there, or a slot that is gone', () => {
      const image = out('image')

      expect(image.moveLinksTo('missing')).toBeUndefined()
      graph.remove(source)
      expect(image.moveLinksTo('copy')).toBeUndefined()
    })

    it('gives nothing when the output to move to is gone', () => {
      const copy = out('copy')
      source.removeOutput(1)

      expect(edit.moveLinks(out('image'), copy)).toBeUndefined()
    })

    it('gives nothing when the link store refuses', () => {
      const link = source.connect(0, target, 0)
      vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
        ok: false,
        error: { code: 'occupied-target', message: 'refused' }
      })

      expect(out('image').moveLinksTo('copy')).toBeUndefined()
      expect(link?.origin_slot).toBe(0)
    })

    it('refuses outputs of two nodes, an input, or a reference it cannot use', () => {
      const elsewhere = handleOf(other)
      other.addOutput('o', 'IMAGE')
      const otherOutput = elsewhere.outputs.at(0)
      assert(otherOutput)

      expect(() => edit.moveLinks(out('image'), otherOutput)).toThrow(TypeError)
      expect(() =>
        Reflect.apply(edit.moveLinks, undefined, [
          out('image'),
          into(targetHandle, 'pixels')
        ])
      ).toThrow(TypeError)
      expect(() =>
        Reflect.apply(out('image').moveLinksTo, undefined, [1])
      ).toThrow(TypeError)
    })
  })
})
