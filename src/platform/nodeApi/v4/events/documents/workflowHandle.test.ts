import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

function graphWithNode(title: string) {
  const graph = new LGraph()
  const node = new LGraphNode(title)
  graph.add(node)
  const { comfy } = createComfyApi({ getGraph: () => graph })
  return { graph, node, comfy }
}

const WORKFLOW = {
  version: 0.4,
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {}
}

describe('workflow.snapshot', () => {
  it('copies the open workflow as it would be saved, frozen all the way down', () => {
    const { graph, comfy } = graphWithNode('Saved')

    const snapshot = comfy.workflow.snapshot()

    expect(snapshot).toEqual(JSON.parse(JSON.stringify(graph.serialize())))
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot?.nodes)).toBe(true)
  })

  it('is undefined before there is a graph', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(comfy.workflow.snapshot()).toBeUndefined()
  })
})

describe('workflow.applyTextReplacements', () => {
  it('expands a node widget token against the open workflow', () => {
    const { node, comfy } = graphWithNode('Sampler')
    node.addWidget('number', 'seed', 42, () => {})

    expect(comfy.workflow.applyTextReplacements('seed %Sampler.seed%')).toBe(
      'seed 42'
    )
  })

  it('is undefined before there is a graph', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(comfy.workflow.applyTextReplacements('%date:yyyy%')).toBeUndefined()
  })

  it('refuses a value that is not a string', () => {
    const { comfy } = graphWithNode('Sampler')

    expect(() =>
      Reflect.apply(comfy.workflow.applyTextReplacements, comfy.workflow, [1])
    ).toThrow('workflow.applyTextReplacements needs a string, not 1.')
  })
})

describe('workflow.open', () => {
  it('hands a valid workflow to the host loader and resolves once it loaded', async () => {
    const { comfy } = graphWithNode('Before')
    const load = vi.spyOn(app, 'loadGraphData').mockResolvedValue(true)

    await expect(comfy.workflow.open(WORKFLOW)).resolves.toBe(true)

    expect(load).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ version: 0.4, nodes: [] })
    )
  })

  it.for([false, undefined])(
    'resolves false when the host loader returns %s',
    async (outcome) => {
      const { comfy } = graphWithNode('Before')
      vi.spyOn(app, 'loadGraphData').mockResolvedValue(outcome)

      await expect(comfy.workflow.open(WORKFLOW)).resolves.toBe(false)
    }
  )

  it.for([
    ['a string', '{}'],
    ['null', null],
    ['an object with no version', { nodes: [] }]
  ] as const)('refuses %s without loading anything', async ([, data]) => {
    const { comfy } = graphWithNode('Before')
    const load = vi.spyOn(app, 'loadGraphData')

    await expect(
      Reflect.apply(comfy.workflow.open, comfy.workflow, [data])
    ).rejects.toThrow(TypeError)
    expect(load).not.toHaveBeenCalled()
  })
})
