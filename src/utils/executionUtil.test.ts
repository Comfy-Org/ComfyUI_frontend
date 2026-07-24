import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

import { graphToPrompt } from './executionUtil'

type WidgetFixture = {
  name: string
  options?: IWidgetOptions
  serializeValue?: IBaseWidget['serializeValue']
  serialize?: boolean
  syncToWorkflow?: boolean
} & (
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'combo'; value: string | number }
  | { type: 'custom'; value: Record<string, unknown> }
)

function requireWidgetValues(node: { widgets_values?: unknown }): unknown[] {
  if (!Array.isArray(node.widgets_values)) {
    throw new TypeError('Expected serialized widget values to be an array')
  }
  return node.widgets_values
}

describe('graphToPrompt', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function createNodeWithWidgets(
    graph: LGraph,
    title: string,
    widgets: WidgetFixture[]
  ): LGraphNode {
    const node = new LGraphNode(title)
    node.comfyClass = title
    node.serialize_widgets = true
    node.addOutput('output', 'IMAGE')

    for (const w of widgets) {
      let widget: IBaseWidget
      switch (w.type) {
        case 'number':
          widget = node.addWidget('number', w.name, w.value, null, w.options)
          break
        case 'text':
          widget = node.addWidget('text', w.name, w.value, null, w.options)
          break
        case 'combo':
          widget = node.addWidget('combo', w.name, w.value, null, w.options)
          break
        case 'custom':
          widget = node.addWidget('custom', w.name, w.value, null, w.options)
      }
      if (w.serializeValue) {
        widget.serializeValue = w.serializeValue
      }
      if (w.serialize === false) {
        widget.serialize = false
      }
      if (w.syncToWorkflow === false) {
        widget.syncToWorkflow = false
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
      expect(requireWidgetValues(wfNode)[0]).toBe('cat')
      expect(requireWidgetValues(wfNode)[1]).toBe(20)
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
      expect(requireWidgetValues(wfNode)[0]).toBe('resolved-async')
    })

    it('syncs existing name-keyed workflow widget values', async () => {
      const graph = new LGraph()
      const node = createNodeWithWidgets(graph, 'RecordNode', [
        {
          type: 'text',
          name: 'prompt',
          value: '{cat|dog}',
          serializeValue: () => 'cat'
        },
        {
          type: 'text',
          name: 'unmapped',
          value: 'original',
          serializeValue: () => 'resolved'
        }
      ])
      node.onSerialize = (serialized) => {
        Object.assign(serialized, {
          widgets_values: { prompt: 'original', preserved: 'value' }
        })
      }

      const { workflow, output } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]
      const nodeId = String(wfNode.id)

      expect(output[nodeId].inputs.prompt).toBe('cat')
      expect(output[nodeId].inputs.unmapped).toBe('resolved')
      expect(wfNode.widgets_values).toEqual({
        prompt: 'cat',
        preserved: 'value'
      })
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
      expect(requireWidgetValues(wfNode1)[0]).toBe(100)

      // Simulate seed change (e.g. beforeQueued randomises the seed)
      node.widgets![0].value = 999

      // Second call — seed is 999
      const result2 = await graphToPrompt(graph)
      const wfNode2 = result2.workflow.nodes[0]

      expect(result2.output[nodeId].inputs.seed).toBe(999)
      expect(requireWidgetValues(wfNode2)[0]).toBe(999)

      // Verify first call was not mutated
      expect(requireWidgetValues(wfNode1)[0]).toBe(100)
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
      expect(requireWidgetValues(wfNode)[0]).toBe(42)
      // control widget's workflow value should be its original value
      // (set by graph.serialize, not modified by sync)
      expect(requireWidgetValues(wfNode)[1]).toBe('randomize')
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
      expect(requireWidgetValues(wfNode)[0]).toBe(10)
      // hidden widget (serialize: false) should not appear in widgets_values
      // because LGraphNode.serialize() skips it
      expect(requireWidgetValues(wfNode)[1]).toBeUndefined()
    })

    it('preserves workflow values for execution-only transforms', async () => {
      const graph = new LGraph()
      const prefix = 'ComfyUI_%date:yyyy-MM-dd%'
      createNodeWithWidgets(graph, 'SaveImage', [
        {
          type: 'text',
          name: 'filename_prefix',
          value: prefix,
          serializeValue: () => 'ComfyUI_2026-07-24',
          syncToWorkflow: false
        }
      ])

      const { workflow, output } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]
      const nodeId = String(wfNode.id)

      expect(output[nodeId].inputs.filename_prefix).toBe('ComfyUI_2026-07-24')
      expect(requireWidgetValues(wfNode)[0]).toBe(prefix)
    })

    it('handles object widget values by deep-cloning', async () => {
      const objValue = { key: 'value', nested: { a: 1 } }
      const timestamp = new Date('2026-07-24T00:00:00.000Z')
      const graph = new LGraph()
      createNodeWithWidgets(graph, 'ObjectNode', [
        {
          type: 'custom',
          name: 'config',
          value: objValue,
          serializeValue: () => ({
            key: 'modified',
            nested: { a: 2 },
            timestamp
          })
        }
      ])

      const { workflow, output } = await graphToPrompt(graph)
      const wfNode = workflow.nodes[0]

      // Should be deep-cloned, not a reference
      const synced = requireWidgetValues(wfNode)[0] as Record<string, unknown>
      expect(synced).toEqual({
        key: 'modified',
        nested: { a: 2 },
        timestamp
      })

      // Verify reference independence: mutating synced does not affect output
      ;(synced.nested as Record<string, unknown>).a = 999
      const nodeId = String(wfNode.id)
      const outputValue = output[nodeId].inputs.config as Record<
        string,
        unknown
      >
      expect((outputValue.nested as Record<string, unknown>).a).toBe(2)
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
        expect(requireWidgetValues(result.workflow.nodes[0])[0]).toBe(
          seeds[idx]
        )
      }

      // Steps and cfg should be the same across all iterations
      for (const result of results) {
        expect(result.output[nodeId].inputs.steps).toBe(20)
        expect(result.output[nodeId].inputs.cfg).toBe(7.5)
        expect(requireWidgetValues(result.workflow.nodes[0])[1]).toBe(20)
        expect(requireWidgetValues(result.workflow.nodes[0])[2]).toBe(7.5)
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
      expect(requireWidgetValues(result1.workflow.nodes[0])[0]).toBe('result-1')
      expect(requireWidgetValues(result2.workflow.nodes[0])[0]).toBe('result-2')
      expect(requireWidgetValues(result3.workflow.nodes[0])[0]).toBe('result-3')
    })
  })
})
