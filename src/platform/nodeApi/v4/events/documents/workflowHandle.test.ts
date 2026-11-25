import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

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

  it('opens a workflow with a node of a pack whose version is no semver, such as 7.8', async () => {
    const graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    const packId = registerTestPack(api, {
      segment: 'image-filter',
      id: 'cg-image-filter',
      version: '7.8'
    })
    onTestFinished(api.comfy.defs.define(packId, { type: 'Filter/Defined' }))
    api.comfy.graph.add('Filter/Defined')
    const saved = JSON.parse(JSON.stringify(graph.serialize()))
    vi.spyOn(app, 'loadGraphData').mockResolvedValue(true)

    await expect(api.comfy.workflow.open(saved)).resolves.toBe(true)
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
    ['null', null]
  ] as const)(
    'refuses %s at the call, without loading anything',
    ([, data]) => {
      const { comfy } = graphWithNode('Before')
      const load = vi.spyOn(app, 'loadGraphData')

      expectRefusal(
        () => Reflect.apply(comfy.workflow.open, comfy.workflow, [data]),
        'workflow.open'
      )
      expect(load).not.toHaveBeenCalled()
    }
  )

  it('resolves false for an object that is not a workflow, without loading it', async () => {
    const { comfy } = graphWithNode('Before')
    const load = vi.spyOn(app, 'loadGraphData')

    await expect(comfy.workflow.open({ nodes: [] })).resolves.toBe(false)
    expect(load).not.toHaveBeenCalled()
  })
})
