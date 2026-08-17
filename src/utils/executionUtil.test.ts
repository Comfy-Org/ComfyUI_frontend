import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

describe('graphToPrompt', () => {
  it('should preserve virtual node widget value when linked to a forceInput slot', async () => {
    const graph = new LGraph()

    const targetNode = new LGraphNode('TargetNode')
    targetNode.comfyClass = 'KSampler'
    targetNode.addInput('seed', 'INT')
    targetNode.addOutput('out', 'IMAGE')
    graph.add(targetNode)

    const primitiveNode = new LGraphNode('PrimitiveNode', 'PrimitiveNode')
    primitiveNode.isVirtualNode = true
    primitiveNode.addOutput('connect to widget input', '*')
    primitiveNode.addWidget('number', 'value', 12345, null)
    graph.add(primitiveNode)

    primitiveNode.connect(0, targetNode, 0)

    const { output } = await graphToPrompt(graph)
    const targetOutput = output[String(targetNode.id)]

    expect(targetOutput).toBeDefined()
    expect(targetOutput.inputs.seed).toBe(12345)
  })

  it('should preserve string widget value from virtual node', async () => {
    const graph = new LGraph()

    const targetNode = new LGraphNode('TargetNode')
    targetNode.comfyClass = 'CLIPTextEncode'
    targetNode.addInput('text', 'STRING')
    targetNode.addOutput('CONDITIONING', 'CONDITIONING')
    graph.add(targetNode)

    const primitiveNode = new LGraphNode('PrimitiveNode', 'PrimitiveNode')
    primitiveNode.isVirtualNode = true
    primitiveNode.addOutput('connect to widget input', '*')
    primitiveNode.addWidget('text', 'value', 'a beautiful landscape', null)
    graph.add(primitiveNode)

    primitiveNode.connect(0, targetNode, 0)

    const { output } = await graphToPrompt(graph)
    const targetOutput = output[String(targetNode.id)]

    expect(targetOutput).toBeDefined()
    expect(targetOutput.inputs.text).toBe('a beautiful landscape')
  })

  it('should not include virtual nodes in API output', async () => {
    const graph = new LGraph()

    const targetNode = new LGraphNode('TargetNode')
    targetNode.comfyClass = 'KSampler'
    targetNode.addInput('seed', 'INT')
    graph.add(targetNode)

    const primitiveNode = new LGraphNode('PrimitiveNode', 'PrimitiveNode')
    primitiveNode.isVirtualNode = true
    primitiveNode.addOutput('connect to widget input', '*')
    primitiveNode.addWidget('number', 'value', 42, null)
    graph.add(primitiveNode)

    primitiveNode.connect(0, targetNode, 0)

    const { output } = await graphToPrompt(graph)

    expect(output[String(primitiveNode.id)]).toBeUndefined()
    expect(Object.keys(output)).toHaveLength(1)
  })

  it('should not export widget values from non-Primitive virtual nodes', async () => {
    const graph = new LGraph()

    const targetNode = new LGraphNode('TargetNode', 'TargetNode')
    targetNode.comfyClass = 'TargetNode'
    targetNode.addInput('payload', 'STRING')
    graph.add(targetNode)

    const virtualNode = new LGraphNode('Custom Virtual', 'CustomVirtualNode')
    virtualNode.isVirtualNode = true
    virtualNode.addOutput('out', 'STRING')
    virtualNode.addWidget('text', 'status', 'ui-only value', null)
    graph.add(virtualNode)

    virtualNode.connect(0, targetNode, 0)

    const { output } = await graphToPrompt(graph)

    expect(output[String(targetNode.id)].inputs).not.toHaveProperty('payload')
    expect(output[String(virtualNode.id)]).toBeUndefined()
  })
})
