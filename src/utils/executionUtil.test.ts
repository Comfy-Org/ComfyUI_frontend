import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('graphToPrompt', () => {
  it('excludes nodes with isVirtualNode from API output', async () => {
    const graph = new LGraph()
    const realNode = new LGraphNode('RealNode')
    realNode.comfyClass = 'KSampler'
    graph.add(realNode)

    const virtualNode = new LGraphNode('VirtualNode')
    virtualNode.isVirtualNode = true
    virtualNode.comfyClass = 'Note'
    graph.add(virtualNode)

    const { output } = await graphToPrompt(graph)

    expect(output[String(virtualNode.id)]).toBeUndefined()
    expect(output[String(realNode.id)]).toBeDefined()
    expect(output[String(realNode.id)].class_type).toBe('KSampler')
  })

  it('produces empty output when all nodes are virtual', async () => {
    const graph = new LGraph()

    const note = new LGraphNode('Note')
    note.isVirtualNode = true
    note.comfyClass = 'Note'
    graph.add(note)

    const mdNote = new LGraphNode('MarkdownNote')
    mdNote.isVirtualNode = true
    mdNote.comfyClass = 'MarkdownNote'
    graph.add(mdNote)

    const { output } = await graphToPrompt(graph)

    expect(Object.keys(output)).toHaveLength(0)
  })

  it('includes virtual nodes in workflow JSON for save fidelity', async () => {
    const graph = new LGraph()

    const note = new LGraphNode('Note')
    note.isVirtualNode = true
    note.comfyClass = 'Note'
    graph.add(note)

    const realNode = new LGraphNode('RealNode')
    realNode.comfyClass = 'KSampler'
    graph.add(realNode)

    const { workflow, output } = await graphToPrompt(graph)

    expect(
      workflow.nodes.some((n) => n.id === note.id),
      'Workflow JSON should preserve virtual nodes by ID'
    ).toBe(true)
    expect(output[String(note.id)]).toBeUndefined()
  })

  it('preserves multiple non-virtual nodes', async () => {
    const graph = new LGraph()

    const node1 = new LGraphNode('Node1')
    node1.comfyClass = 'KSampler'
    graph.add(node1)

    const node2 = new LGraphNode('Node2')
    node2.comfyClass = 'SaveImage'
    graph.add(node2)

    const { output } = await graphToPrompt(graph)

    expect(Object.keys(output)).toHaveLength(2)
    expect(output[String(node1.id)].class_type).toBe('KSampler')
    expect(output[String(node2.id)].class_type).toBe('SaveImage')
  })
})
