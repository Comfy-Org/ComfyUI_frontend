import { describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

describe('graphToPrompt', () => {
  it('records resolved node dependencies', async () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.comfyClass = 'Source'
    source.addOutput('value', '*')
    const target = new LGraphNode('Target')
    target.comfyClass = 'Target'
    target.addInput('value', '*')
    graph.add(source)
    graph.add(target)
    source.connect(0, target, 0)

    const { nodeDependencies } = await graphToPrompt(graph)

    expect(nodeDependencies.get(String(source.id))).toEqual(new Set())
    expect(nodeDependencies.get(String(target.id))).toEqual(
      new Set([String(source.id)])
    )
  })

  it('excludes muted origin nodes from executable dependencies', async () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.comfyClass = 'Source'
    source.mode = LGraphEventMode.NEVER
    source.addOutput('value', '*')
    const target = new LGraphNode('Target')
    target.comfyClass = 'Target'
    target.addInput('value', '*')
    graph.add(source)
    graph.add(target)
    source.connect(0, target, 0)

    const { nodeDependencies } = await graphToPrompt(graph)

    expect(nodeDependencies.has(String(source.id))).toBe(false)
  })
})
