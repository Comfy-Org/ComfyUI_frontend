import axios from 'axios'
import { api } from '@/scripts/api'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { graphToPrompt } from '@/utils/executionUtil'

function setup(min = 0, max = 3) {
  const graph = new LGraph()
  const node = new LGraphNode('DynamicGroupTest')
  node.comfyClass = 'DynamicGroupTest'
  node.serialize_widgets = true
  graph.add(node)
  const { addNodeInput } = useLitegraphService()
  addNodeInput(node, {
    name: 'before',
    type: 'STRING',
    default: 'first',
    isOptional: false
  })
  addNodeInput(node, {
    name: 'loras',
    type: 'COMFY_DYNAMICGROUP_V3',
    isOptional: false,
    min,
    max,
    group_name: 'LoRA',
    template: {
      required: {
        lora_name: ['COMBO', { options: ['A', 'B', 'C'] }],
        strength: ['FLOAT', { default: 1 }]
      },
      optional: { enabled: ['BOOLEAN', { default: true }] }
    }
  })
  addNodeInput(node, {
    name: 'after',
    type: 'STRING',
    default: 'last',
    isOptional: false
  })
  function widget(name: string) {
    const found = node.widgets?.find((widget) => widget.name === name)
    if (!found) throw new Error(`Missing widget ${name}`)
    return found
  }
  return { node, graph, widget }
}

const namedValuesRestore = LiteGraph.namedValuesRestore
afterEach(() => {
  LiteGraph.namedValuesRestore = namedValuesRestore
})

describe('DynamicGroup widgets', () => {
  it('removes remote combo controls and subscriptions with their row', () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: ['A', 'B'] })
    const { graph, node, widget } = setup()
    useLitegraphService().addNodeInput(node, {
      name: 'remote',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: 3,
      template: {
        required: {
          model: [
            'COMBO',
            {
              remote: {
                route: '/test/dynamic-group-remote',
                refresh_button: true
              }
            }
          ]
        }
      }
    })
    widget('remote').value = 2
    const first = widget('remote.0.model')
    const survivor = widget('remote.1.model')
    const firstRefresh = vi.spyOn(first, 'refresh').mockImplementation(() => {})
    const survivorRefresh = vi
      .spyOn(survivor, 'refresh')
      .mockImplementation(() => {})
    widget('remote.0.model.0').callback?.(true)
    widget('remote.1.model.0').callback?.(true)
    api.dispatchCustomEvent('execution_success', {
      prompt_id: 'test',
      timestamp: 0
    })
    expect(firstRefresh).toHaveBeenCalledTimes(1)
    expect(survivorRefresh).toHaveBeenCalledTimes(1)

    widget('remote.0').callback?.(undefined)
    api.dispatchCustomEvent('execution_success', {
      prompt_id: 'test',
      timestamp: 0
    })
    expect(firstRefresh).toHaveBeenCalledTimes(1)
    expect(survivorRefresh).toHaveBeenCalledTimes(2)
    expect(widget('remote.0.model')).toBe(survivor)
    expect(
      node.widgets
        ?.filter((w) => w.name.startsWith('remote.'))
        .map((w) => w.name)
    ).toEqual([
      'remote.0',
      'remote.0.model',
      'remote.0.model.0',
      'remote.0.model.1',
      'remote.$add'
    ])
    widget('remote.0').callback?.(undefined)
    expect(
      node.widgets
        ?.filter((w) => w.name.startsWith('remote.'))
        .map((w) => w.name)
    ).toEqual(['remote.$add'])
    graph.remove(node)
    api.dispatchCustomEvent('execution_success', {
      prompt_id: 'test',
      timestamp: 0
    })
    expect(survivorRefresh).toHaveBeenCalledTimes(2)
  })

  it('keeps control widgets with their row through removal and restoration', () => {
    const { node, widget } = setup()
    useLitegraphService().addNodeInput(node, {
      name: 'seeds',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: 3,
      template: {
        required: {
          seed: ['INT', { default: 1, control_after_generate: true }]
        }
      }
    })
    widget('seeds').value = 2
    widget('seeds.1.seed.0').value = 'fixed'
    widget('seeds.0').callback?.(undefined)
    expect(widget('seeds.0.seed.0').value).toBe('fixed')
    const saved = node.serialize()

    widget('seeds').value = 0
    node.configure(saved)

    expect(widget('seeds.0.seed.0').value).toBe('fixed')
    expect(
      node.widgets?.filter((w) => w.name.startsWith('seeds.'))
    ).toHaveLength(4)
  })

  it('restores rows and their edited values after switching the containing DynamicCombo', () => {
    const { node, widget } = setup()
    useLitegraphService().addNodeInput(node, {
      name: 'mode',
      type: 'COMFY_DYNAMICCOMBO_V3',
      isOptional: false,
      options: [
        {
          key: 'on',
          inputs: {
            required: {
              rows: [
                'COMFY_DYNAMICGROUP_V3',
                {
                  min: 0,
                  max: 3,
                  template: { required: { text: ['STRING', { default: '' }] } }
                }
              ]
            }
          }
        },
        { key: 'off', inputs: {} }
      ]
    })
    widget('mode.rows').value = 2
    widget('mode.rows.1.text').value = 'saved'

    widget('mode').value = 'off'
    widget('mode').value = 'on'

    expect(widget('mode.rows').value).toBe(2)
    expect(widget('mode.rows.1.text').value).toBe('saved')
  })

  it('uses refreshed template options when adding another row', () => {
    const { node, widget } = setup()
    node.type = 'DynamicGroupTest'
    widget('loras').value = 1
    const definition: ComfyNodeDef = {
      name: 'DynamicGroupTest',
      display_name: 'DynamicGroupTest',
      category: 'test',
      python_module: 'test',
      description: '',
      output: [],
      output_node: false,
      deprecated: false,
      experimental: false,
      input: {
        required: {
          loras: [
            'COMFY_DYNAMICGROUP_V3',
            {
              min: 0,
              max: 3,
              template: {
                required: {
                  lora_name: ['COMBO', { options: ['A', 'B', 'C', 'D'] }]
                }
              }
            }
          ]
        }
      }
    }
    useNodeDefStore().updateNodeDefs([definition])

    widget('loras.$add').callback?.(undefined)

    expect(widget('loras.1.lora_name').options.values).toEqual([
      'A',
      'B',
      'C',
      'D'
    ])
  })

  it('submits no group fields for zero rows, then creates complete rows up to max', async () => {
    const { node, graph, widget } = setup()
    expect((await graphToPrompt(graph)).output[node.id].inputs).toEqual({
      before: 'first',
      after: 'last'
    })
    for (let i = 0; i < 4; i++) widget('loras.$add').callback?.(undefined)
    expect(widget('loras').value).toBe(3)
    expect(widget('loras.$add').options.disabled).toBe(true)
    expect((await graphToPrompt(graph)).output[node.id].inputs).toEqual({
      before: 'first',
      after: 'last',
      'loras.0.lora_name': 'A',
      'loras.0.strength': 1,
      'loras.0.enabled': true,
      'loras.1.lora_name': 'A',
      'loras.1.strength': 1,
      'loras.1.enabled': true,
      'loras.2.lora_name': 'A',
      'loras.2.strength': 1,
      'loras.2.enabled': true
    })
  })

  it('preserves surviving values, links and widget identities when deleting the middle row', async () => {
    const { node, graph, widget } = setup()
    widget('loras').value = 3
    widget('loras.0.lora_name').value = 'A'
    widget('loras.1.lora_name').value = 'B'
    widget('loras.2.lora_name').value = 'C'
    widget('loras.2.strength').value = 0.5
    const source = new LGraphNode('Source')
    source.addOutput('value', 'FLOAT')
    graph.add(source)
    const retained = source.connect(
      0,
      node,
      node.findInputSlot('loras.2.strength')
    )
    const removed = source.connect(
      0,
      node,
      node.findInputSlot('loras.1.strength')
    )
    if (!retained || !removed) throw new Error('Failed to connect group fields')

    widget('loras.1').callback?.(undefined)

    expect(widget('loras').value).toBe(2)
    expect(widget('loras.1.lora_name').value).toBe('C')
    expect(widget('loras.1.strength').value).toBe(0.5)
    expect(node.getInputLink(node.findInputSlot('loras.1.strength'))).toBe(
      retained
    )
    expect(graph.getLink(removed.id)).toBeUndefined()
    const id = widget('loras.1.lora_name').widgetId
    if (!id) throw new Error('Widget not registered')
    expect(useWidgetValueStore().getWidget(id)?.value).toBe('C')
    expect(node.widgets?.some((w) => w.name.startsWith('loras.2'))).toBe(false)
    const inputs = (await graphToPrompt(graph)).output[node.id].inputs
    expect(inputs['loras.1.strength']).toEqual([String(source.id), 0])
    expect(inputs['loras.1.lora_name']).toBe('C')
  })

  it('keeps min rows and ignores non-finite restored counts', () => {
    const { widget } = setup(1, 2)
    widget('loras.0').callback?.(undefined)
    expect(widget('loras').value).toBe(1)
    widget('loras').value = 2
    expect(widget('loras').value).toBe(2)
    widget('loras').value = NaN
    expect(widget('loras').value).toBe(2)
    widget('loras').value = 1.9
    expect(widget('loras').value).toBe(1)
    widget('loras').value = -1
    expect(widget('loras').value).toBe(1)
  })

  it.for([false, true])(
    'preserves restored overflow rows with named restoration = %s',
    (named) => {
      LiteGraph.namedValuesRestore = named
      const { node, widget } = setup(0, 5)
      widget('loras').value = 6
      widget('loras.5.lora_name').value = 'C'
      const restored = setup(0, 5)
      restored.node.configure(node.serialize())
      expect(restored.widget('loras').value).toBe(6)
      expect(restored.widget('loras.5.lora_name').value).toBe('C')
      restored.widget('loras.$add').callback?.(undefined)
      expect(restored.widget('loras').value).toBe(6)
      restored.widget('loras.0').callback?.(undefined)
      expect(restored.widget('loras.$add').options.disabled).toBe(true)
      restored.widget('loras.$add').callback?.(undefined)
      expect(restored.widget('loras').value).toBe(5)
      restored.widget('loras.0').callback?.(undefined)
      expect(restored.widget('loras.$add').options.disabled).toBe(false)
      restored.widget('loras.$add').callback?.(undefined)
      expect(restored.widget('loras').value).toBe(5)
    }
  )

  it.for([false, true])(
    'restores static widgets surrounding rows with named restoration = %s',
    async (named) => {
      LiteGraph.namedValuesRestore = named
      const { node, graph, widget } = setup()
      widget('before').value = 'head'
      widget('loras').value = 2
      widget('loras.1.lora_name').value = 'B'
      widget('loras.1.strength').value = 0.6
      widget('loras.1.enabled').value = false
      widget('after').value = 'tail'
      node.setSize([400, 600])
      const saved = node.serialize()
      expect(saved.widgets_values).toEqual([
        'head',
        2,
        'A',
        1,
        true,
        'B',
        0.6,
        false,
        'tail'
      ])

      const restored = setup()
      restored.node.configure(saved)

      expect(restored.node.serialize().widgets_values).toEqual(
        saved.widgets_values
      )
      expect(restored.node.inputs.map((input) => input.name)).toEqual(
        saved.inputs?.map((input) => input.name)
      )
      expect(restored.node.size[1]).toBe(600)
      expect(
        (await graphToPrompt(restored.graph)).output[restored.node.id].inputs
      ).toEqual((await graphToPrompt(graph)).output[node.id].inputs)
    }
  )
})
