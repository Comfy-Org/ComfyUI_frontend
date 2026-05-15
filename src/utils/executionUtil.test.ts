import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

describe('graphToPrompt', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function createNodeWithWidgets(
    graph: LGraph,
    title: string,
    widgets: {
      type: string
      name: string
      value: unknown
      options?: Record<string, unknown>
      serializeValue?: (
        node: unknown,
        index: number
      ) => Promise<unknown> | unknown
      serialize?: boolean
    }[]
  ): LGraphNode {
    const node = new LGraphNode(title)
    node.comfyClass = title
    node.serialize_widgets = true
    node.addOutput('output', 'IMAGE')

    for (const w of widgets) {
      const widget = node.addWidget(
        w.type as 'number',
        w.name,
        w.value as number,
        null,
        w.options ?? {}
      )
      if (w.serializeValue) {
        widget.serializeValue = w.serializeValue
      }
      if (w.serialize === false) {
        widget.serialize = false
      }
    }

    graph.add(node)
    return node
  }

  describe('workflow metadata sync', () => {
    it('syncs serializeValue results back to workflow widgets_values', async () => {
      const graph = new LGraph()
      createNodeWithWidgets(graph, 'DynamicNode', [
        {
          type: 'text',
          name: 'prompt',
          value: '{cat|dog}',
          serializeValue: () => 'cat'
        },
        { type: 'number', name: 'steps', value: 20 }
      ])

      const { workflow, output } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]
      const nodeId = String(wfNode.id)

      expect(output[nodeId].inputs.prompt).toBe('cat')
      expect(output[nodeId].inputs.steps).toBe(20)

      // workflow widgets_values should match what was sent in the prompt
      expect(wfNode.widgets_values![0]).toBe('cat')
      expect(wfNode.widgets_values![1]).toBe(20)
    })

    it('syncs async serializeValue results', async () => {
      const graph = new LGraph()
      createNodeWithWidgets(graph, 'AsyncNode', [
        {
          type: 'text',
          name: 'data',
          value: 'original',
          serializeValue: () => Promise.resolve('resolved-async')
        }
      ])

      const { workflow, output } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]
      const nodeId = String(wfNode.id)

      expect(output[nodeId].inputs.data).toBe('resolved-async')
      expect(wfNode.widgets_values![0]).toBe('resolved-async')
    })

    it('keeps workflow in sync when widget.value changes between calls', async () => {
      const graph = new LGraph()
      const node = createNodeWithWidgets(graph, 'SeedNode', [
        { type: 'number', name: 'seed', value: 100 },
        { type: 'number', name: 'steps', value: 20 }
      ])

      // First call — seed is 100
      const result1 = await graphToPrompt(graph)
      const wfNode1 = result1.workflow.nodes[0]
      const nodeId = String(wfNode1.id)

      expect(result1.output[nodeId].inputs.seed).toBe(100)
      expect(wfNode1.widgets_values![0]).toBe(100)

      // Simulate seed change (e.g. beforeQueued randomises the seed)
      node.widgets![0].value = 999

      // Second call — seed is 999
      const result2 = await graphToPrompt(graph)
      const wfNode2 = result2.workflow.nodes[0]

      expect(result2.output[nodeId].inputs.seed).toBe(999)
      expect(wfNode2.widgets_values![0]).toBe(999)

      // Verify first call was not mutated
      expect(wfNode1.widgets_values![0]).toBe(100)
    })

    it('does not sync widgets with options.serialize === false', async () => {
      const graph = new LGraph()
      createNodeWithWidgets(graph, 'ControlNode', [
        { type: 'number', name: 'seed', value: 42 },
        {
          type: 'combo',
          name: 'control',
          value: 'randomize',
          options: { serialize: false, values: ['fixed', 'randomize'] }
        }
      ])

      const { workflow, output } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]
      const nodeId = String(wfNode.id)

      // control widget should not appear in output
      expect(output[nodeId].inputs.seed).toBe(42)
      expect(output[nodeId].inputs.control).toBeUndefined()

      // seed should be synced, control should retain its serialized value
      expect(wfNode.widgets_values![0]).toBe(42)
      // control widget's workflow value should be its original value
      // (set by graph.serialize, not modified by sync)
      expect(wfNode.widgets_values![1]).toBe('randomize')
    })

    it('does not sync widgets with widget.serialize === false', async () => {
      const graph = new LGraph()
      createNodeWithWidgets(graph, 'PartialNode', [
        { type: 'number', name: 'visible', value: 10 },
        {
          type: 'number',
          name: 'hidden',
          value: 99,
          serialize: false,
          serializeValue: () => 'transformed'
        }
      ])

      const { workflow } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]

      // visible widget should be synced
      expect(wfNode.widgets_values![0]).toBe(10)
      // hidden widget (serialize: false) should not appear in widgets_values
      // because LGraphNode.serialize() skips it
      expect(wfNode.widgets_values![1]).toBeUndefined()
    })

    it('handles object widget values by deep-cloning', async () => {
      const objValue = { key: 'value', nested: { a: 1 } }
      const graph = new LGraph()
      createNodeWithWidgets(graph, 'ObjectNode', [
        {
          type: 'text',
          name: 'config',
          value: objValue,
          serializeValue: () => ({ key: 'modified', nested: { a: 2 } })
        }
      ])

      const { workflow } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]

      // Should be deep-cloned, not a reference
      const synced = wfNode.widgets_values![0] as Record<string, unknown>
      expect(synced).toEqual({ key: 'modified', nested: { a: 2 } })
    })
  })

  describe('batch count simulation', () => {
    it('produces different workflow metadata when seed changes between calls', async () => {
      const graph = new LGraph()
      const node = createNodeWithWidgets(graph, 'KSampler', [
        { type: 'number', name: 'seed', value: 1000 },
        { type: 'number', name: 'steps', value: 20 },
        { type: 'number', name: 'cfg', value: 7.5 }
      ])

      const results: Awaited<ReturnType<typeof graphToPrompt>>[] = []

      // Simulate batch count = 3, with seed randomised before each call
      const seeds = [1000, 2000, 3000]
      for (const seed of seeds) {
        node.widgets![0].value = seed
        results.push(await graphToPrompt(graph))
      }

      const nodeId = String(results[0].workflow.nodes[0].id)

      // Each iteration should have its own seed in both output and workflow
      for (const [idx, result] of results.entries()) {
        expect(result.output[nodeId].inputs.seed).toBe(seeds[idx])
        expect(result.workflow.nodes[0].widgets_values![0]).toBe(seeds[idx])
      }

      // Steps and cfg should be the same across all iterations
      for (const result of results) {
        expect(result.output[nodeId].inputs.steps).toBe(20)
        expect(result.output[nodeId].inputs.cfg).toBe(7.5)
        expect(result.workflow.nodes[0].widgets_values![1]).toBe(20)
        expect(result.workflow.nodes[0].widgets_values![2]).toBe(7.5)
      }
    })

    it('produces different workflow metadata when serializeValue varies', async () => {
      let callCount = 0
      const graph = new LGraph()
      createNodeWithWidgets(graph, 'DynamicPrompt', [
        {
          type: 'text',
          name: 'prompt',
          value: '{cat|dog|bird}',
          serializeValue: () => {
            callCount++
            return `result-${callCount}`
          }
        }
      ])

      const result1 = await graphToPrompt(graph)
      const result2 = await graphToPrompt(graph)
      const result3 = await graphToPrompt(graph)

      const nodeId = String(result1.workflow.nodes[0].id)

      // Each call should produce a different resolved value
      expect(result1.output[nodeId].inputs.prompt).toBe('result-1')
      expect(result2.output[nodeId].inputs.prompt).toBe('result-2')
      expect(result3.output[nodeId].inputs.prompt).toBe('result-3')

      // Workflow metadata should match the output
      expect(result1.workflow.nodes[0].widgets_values![0]).toBe('result-1')
      expect(result2.workflow.nodes[0].widgets_values![0]).toBe('result-2')
      expect(result3.workflow.nodes[0].widgets_values![0]).toBe('result-3')
    })
  })
})
