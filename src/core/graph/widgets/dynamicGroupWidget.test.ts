import axios, { AxiosHeaders } from 'axios'
import type { AxiosResponse } from 'axios'
import { useLinkStore } from '@/stores/linkStore'
import { api } from '@/scripts/api'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { graphToPrompt } from '@/utils/executionUtil'
import { isWidgetVisibleOnSurface } from '@/types/widgetVisibility'

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
  it('keeps group controls off the canvas while preserving Vue editing and saved values', () => {
    const { node, widget } = setup(1)
    widget('loras.$add').callback?.(undefined)
    widget('loras.1.lora_name').value = 'C'
    const restored = setup(1)
    restored.node.configure(node.serialize())

    expect(restored.node.getLayoutWidgets().map((w) => w.name)).toEqual([
      'before',
      'loras.$notice',
      'after'
    ])
    for (const field of restored.node.widgets ?? []) {
      if (!field.name.startsWith('loras.') || field.name === 'loras.$notice')
        continue
      expect(restored.node.isWidgetVisible(field)).toBe(false)
      expect(restored.node.isWidgetRowVisible(field)).toBe(false)
      if (!field.visibility) throw new Error('Missing widget visibility')
      expect(
        isWidgetVisibleOnSurface(field.visibility, 'vueNode', {
          showAdvanced: false
        })
      ).toBe(true)
    }
    expect(restored.widget('loras.1.lora_name').value).toBe('C')
    restored.widget('loras.0').callback?.(undefined)
    expect(restored.widget('loras.0.lora_name').value).toBe('C')
    expect(restored.widget('loras').value).toBe(1)
  })

  it.for([0, 3])('shows one canvas notice per group with %s rows', (count) => {
    const { node, widget } = setup()
    widget('loras').value = count
    const notice = widget('loras.$notice')
    expect(node.getLayoutWidgets().map((w) => w.name)).toEqual([
      'before',
      'loras.$notice',
      'after'
    ])
    expect(node.isWidgetVisible(notice)).toBe(true)
    if (!notice.visibility) throw new Error('Missing notice visibility')
    for (const surface of ['vueNode', 'panel'] as const) {
      expect(
        isWidgetVisibleOnSurface(notice.visibility, surface, {
          showAdvanced: true
        })
      ).toBe(false)
    }
    expect(node.serialize().widgets_values).toHaveLength(3 + count * 3)
  })

  it('rolls back a rejected row addition without losing existing values or links', () => {
    const { node, graph, widget } = setup()
    widget('loras').value = 1
    widget('loras.0.strength').value = 0.5
    const source = new LGraphNode('Source')
    source.addOutput('strength', 'FLOAT')
    graph.add(source)
    const link = source.connect(0, node, node.findInputSlot('loras.0.strength'))
    const saved = node.serialize()
    const previousWidgets = [...(node.widgets ?? [])]
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const update = vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
      ok: false,
      error: { code: 'unowned-topology', message: 'Rejected' }
    })
    update.mockClear()

    widget('loras').value = 3

    expect(update).toHaveBeenCalledOnce()
    expect(widget('loras').value).toBe(1)
    expect(node.widgets).toEqual(previousWidgets)
    expect(node.serialize()).toEqual(saved)
    expect(node.getInputLink(node.findInputSlot('loras.0.strength'))).toBe(link)
  })

  it('leaves rows and links intact when row removal is rejected', () => {
    const { node, graph, widget } = setup()
    widget('loras').value = 2
    const source = new LGraphNode('Source')
    source.addOutput('strength', 'FLOAT')
    graph.add(source)
    const link = source.connect(0, node, node.findInputSlot('loras.1.strength'))
    const saved = node.serialize()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
      ok: false,
      error: { code: 'unowned-topology', message: 'Rejected' }
    })

    widget('loras.0').callback?.(undefined)
    expect(node.serialize()).toEqual(saved)
    widget('loras').value = 0
    expect(node.serialize()).toEqual(saved)
    expect(node.getInputLink(node.findInputSlot('loras.1.strength'))).toBe(link)
  })

  it('preserves unrelated widgets when cleanup removes another row widget', () => {
    const { node, widget } = setup()
    widget('loras').value = 1
    const sibling = widget('loras.0.enabled')
    widget('loras.0').onRemove = () => {
      if (node.widgets?.includes(sibling)) node.removeWidget(sibling)
    }
    widget('loras.0').callback?.(undefined)
    expect(widget('after').value).toBe('last')
    expect(widget('loras').value).toBe(0)
  })

  it.for([false, true])(
    'rejects unsupported saved row counts before allocating with named restoration = %s',
    (named) => {
      LiteGraph.namedValuesRestore = named
      const { node } = setup()
      const saved = node.serialize()
      saved.widgets_values = ['first', 1e9, 'last']
      saved.widgets_values_named = {
        before: 'first',
        loras: 1e9,
        'loras.999999999.lora_name': 'C',
        after: 'last'
      }
      const add = vi.spyOn(node, 'addCustomWidget').mockImplementation(() => {
        throw new Error('Unexpected row allocation')
      })
      expect(() => node.configure(saved)).toThrow(
        'Invalid saved row count for DynamicGroup'
      )
      expect(add).not.toHaveBeenCalled()
    }
  )

  it('preserves saved values in an error node when the group definition is invalid', () => {
    const { node, graph, widget } = setup()
    const nodeType = 'test/InvalidDynamicGroup'
    node.type = nodeType
    widget('loras').value = 2
    widget('loras.1.lora_name').value = 'C'
    const saved = graph.serialize()
    class InvalidDynamicGroup extends LGraphNode {
      constructor() {
        super('Invalid group')
        useLitegraphService().addNodeInput(this, {
          name: 'loras',
          type: 'COMFY_DYNAMICGROUP_V3',
          isOptional: false,
          min: 0,
          max: 101,
          template: { required: { name: ['STRING', {}] } }
        })
      }
    }
    LiteGraph.registerNodeType(nodeType, InvalidDynamicGroup)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const restored = new LGraph()
      restored.configure(saved)
      const placeholder = restored.getNodeById(node.id)
      expect(placeholder?.has_errors).toBe(true)
      expect(placeholder?.serialize().widgets_values).toEqual(
        saved.nodes[0].widgets_values
      )
    } finally {
      LiteGraph.unregisterNodeType(nodeType)
    }
  })

  it('removes remote combo controls and subscriptions with their row', async () => {
    const response: AxiosResponse<string[]> = {
      data: ['A', 'B'],
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() }
    }
    vi.spyOn(axios, 'get').mockResolvedValue(response)
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
    expect(node.getLayoutWidgets().map((w) => w.name)).toEqual([
      'before',
      'loras.$notice',
      'after',
      'remote.$notice'
    ])
    const first = widget('remote.0.model')
    const survivor = widget('remote.1.model')
    await vi.waitFor(() => expect(first.options.values).toEqual(['A', 'B']))
    expect(first.value).toBe('A')
    first.options.values = undefined
    expect(first.options.values).toEqual(['A', 'B'])
    vi.mocked(axios.get).mockResolvedValue({ ...response, data: ['C'] })
    first.refresh?.()
    await vi.waitFor(() => expect(first.options.values).toEqual(['C']))
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
      'remote.$notice',
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
    ).toEqual(['remote.$notice', 'remote.$add'])
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
    ).toHaveLength(5)
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
