import axios, { AxiosHeaders } from 'axios'
import type { AxiosResponse } from 'axios'
import { cloneDeep } from 'es-toolkit'
import { useLinkStore } from '@/stores/linkStore'
import { api } from '@/scripts/api'

import {
  afterEach,
  assert,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { i18n } from '@/i18n'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useWidgetStore } from '@/stores/widgetStore'
import { promotedInputWidget } from '@/core/graph/subgraph/promotedInputWidget'
import { multiClone } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
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
  const forcedSibling: NonNullable<ComfyNodeDef['input']>['required'] = {
    forced: ['INT', { forceInput: true }],
    before: ['STRING', { default: 'before' }]
  }
  it.for([
    { name: 'group alone', siblings: {}, count: 1, expected: [1, 0.9, 1] },
    {
      name: 'empty group with a forced sibling',
      siblings: forcedSibling,
      count: 0,
      expected: ['before', 0]
    },
    {
      name: 'one row with a forced sibling',
      siblings: forcedSibling,
      count: 1,
      expected: ['before', 1, 0.9, 1]
    }
  ])('round-trips $name', async ({ siblings, count, expected }) => {
    LiteGraph.namedValuesRestore = false
    const name = 'RegisteredDynamicGroupRestore'
    await useLitegraphService().registerNodeDef(name, {
      name,
      display_name: name,
      category: 'testing',
      python_module: 'nodes',
      description: '',
      output_node: false,
      output: [],
      input: {
        required: {
          ...siblings,
          rows: [
            'COMFY_DYNAMICGROUP_V3',
            {
              template: {
                required: {
                  weight: ['FLOAT', { default: 0.9 }],
                  strength: ['FLOAT', { default: 1 }]
                }
              }
            }
          ]
        }
      }
    })
    try {
      const graph = new LGraph()
      const source = LiteGraph.createNode(name)
      const restored = LiteGraph.createNode(name)
      if (!source || !restored) throw new Error('Node construction failed')
      graph.add(source)
      graph.add(restored)
      const controller = source.widgets?.find((w) => w.name === 'rows')
      assert.exists(controller)
      controller.value = count
      const saved = source.serialize()
      expect(saved.widgets_values).toEqual(expected)

      restored.configure(saved)

      expect(restored.serialize().widgets_values).toEqual(expected)
      expect(saved.widgets_values).toEqual(expected)
    } finally {
      LiteGraph.unregisterNodeType(name)
    }
  })

  it.for([
    {
      name: 'clipboard cloning',
      clone: (node: LGraphNode) => node.clone()?.serialize()
    },
    {
      name: 'subgraph conversion cloning',
      clone: (node: LGraphNode) => multiClone([node])[0]
    }
  ])('clones populated rows through $name', async ({ clone }) => {
    LiteGraph.namedValuesRestore = false
    const name = 'RegisteredDynamicGroupClone'
    await useLitegraphService().registerNodeDef(name, {
      name,
      display_name: name,
      category: 'testing',
      python_module: 'nodes',
      description: '',
      output_node: false,
      output: [],
      input: {
        required: {
          rows: [
            'COMFY_DYNAMICGROUP_V3',
            {
              template: {
                required: {
                  weight: ['FLOAT', { default: 1 }],
                  strength: ['FLOAT', { default: 1 }]
                }
              }
            }
          ]
        }
      }
    })
    const graph = new LGraph()
    const source = LiteGraph.createNode(name)
    assert.exists(source)
    graph.add(source)
    const values = [2, 0.25, 0.8, 0.5, 0.6]
    source.configure({ ...source.serialize(), widgets_values: values })

    const copied = clone(source)

    expect(copied?.widgets_values).toEqual(values)
    expect(source.serialize().widgets_values).toEqual(values)
  })

  it.for([
    {
      name: 'a newly appended trailing widget',
      values: ['first', 1, 'B', 0.4, false],
      expected: ['first', 1, 'B', 0.4, false, 'last']
    },
    {
      name: 'a removed template field across two rows',
      values: ['first', 2, 'A', 0.8, true, 'removed', 'B', 0.5, false, 'tail'],
      expected: ['first', 2, 'A', 0.8, true, 'removed', 'B', 0.5, false]
    },
    {
      name: 'an appended template field across two rows',
      values: ['first', 2, 'A', 0.8, 'B', 0.5, 'tail'],
      expected: ['first', 2, 'A', 0.8, 'B', 0.5, 'tail', true, 'last']
    },
    {
      name: 'reordered template fields',
      values: ['first', 1, 0.8, 'B', false, 'tail'],
      expected: ['first', 1, 0.8, 'B', false, 'tail']
    },
    {
      name: 'missing values in the remaining rows',
      values: ['first', 3, 'B', 0.4, false],
      expected: [
        'first',
        3,
        'B',
        0.4,
        false,
        'A',
        1,
        true,
        'A',
        1,
        true,
        'last'
      ]
    }
  ])('restores positional values with $name', ({ values, expected }) => {
    LiteGraph.namedValuesRestore = false
    const { node } = setup()
    const saved = node.serialize()
    saved.widgets_values = values

    node.configure(saved)

    expect(node.serialize().widgets_values).toEqual(expected)
    expect(saved.widgets_values).toEqual(values)
  })

  it('restores auxiliary controls when a trailing widget has no saved value', () => {
    LiteGraph.namedValuesRestore = false
    const { node, widget } = setup()
    useLitegraphService().addNodeInput(node, {
      name: 'seeds',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      template: {
        required: { seed: ['INT', { control_after_generate: true }] }
      }
    })
    useLitegraphService().addNodeInput(node, {
      name: 'tail',
      type: 'STRING',
      isOptional: false,
      default: 'untouched'
    })
    const saved = node.serialize()
    saved.widgets_values = ['first', 0, 'last', 1, 12, 'fixed']

    node.configure(saved)

    expect(widget('seeds').value).toBe(1)
    expect(widget('seeds.0.seed').value).toBe(12)
    expect(widget('seeds.0.seed.0').value).toBe('fixed')
    expect(widget('tail').value).toBe('untouched')
  })

  it('creates and serializes registered rich and custom template widgets', async () => {
    const { node, graph, widget } = setup()
    useWidgetStore().registerCustomWidgets({
      TEST_DYNAMIC_FIELD: (node, name) => ({
        widget: node.addWidget('text', name, 'custom', () => {})
      })
    })
    useLitegraphService().addNodeInput(node, {
      name: 'rich',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      template: {
        required: {
          color: ['COLOR', { default: '#ffffff' }],
          custom: ['TEST_DYNAMIC_FIELD', {}],
          override: [
            'CUSTOM_DATA',
            { widgetType: 'STRING', default: 'overridden' }
          ]
        }
      }
    })
    widget('rich').value = 1
    widget('rich.0.color').value = '#123456'
    expect((await graphToPrompt(graph)).output[node.id].inputs).toMatchObject({
      'rich.0.color': '#123456',
      'rich.0.custom': 'custom',
      'rich.0.override': 'overridden'
    })
    const saved = node.serialize()
    widget('rich').value = 0
    node.configure(saved)
    expect(widget('rich.0.color').value).toBe('#123456')
  })

  it('rejects socket-only templates before creating group widgets', () => {
    const { node } = setup()
    const before = node.serialize()
    expect(() =>
      useLitegraphService().addNodeInput(node, {
        name: 'images',
        type: 'COMFY_DYNAMICGROUP_V3',
        isOptional: false,
        template: { required: { image: ['IMAGE', {}] } }
      })
    ).toThrow('requires a registered widget')
    expect(node.serialize()).toEqual(before)
  })

  it.for([
    { label: 'LoRA #2 strength', expected: 'LoRA #1 strength' },
    { label: 'My strength', expected: 'My strength' }
  ])(
    'shows $expected after removing a row before the promoted field $label',
    ({ label, expected }) => {
      const { node, graph, widget } = setup()
      graph.remove(node)
      const subgraph = createTestSubgraph({ rootGraph: graph })
      const host = createTestSubgraphNode(subgraph)
      subgraph.add(node)
      widget('loras').value = 2
      const strength = widget('loras.1.strength')
      expect(strength.label).toBe('LoRA #2 strength')
      expect(promoteValueWidgetViaSubgraphInput(host, node, strength).ok).toBe(
        true
      )
      const input = host.inputs[0]
      expect(promotedInputWidget(input)?.label).toBe('LoRA #2 strength')
      subgraph.renameInput(subgraph.inputs[0], label)

      widget('loras.0').callback?.(undefined)

      expect(strength.name).toBe('loras.0.strength')
      expect(strength.label).toBe('LoRA #1 strength')
      expect(promotedInputWidget(input)?.label).toBe(expected)
    }
  )

  function setupTwiceDeepPromotion() {
    const { node, graph, widget } = setup()
    graph.remove(node)
    const outerSubgraph = createTestSubgraph({ rootGraph: graph })
    const outerHost = createTestSubgraphNode(outerSubgraph)
    graph.add(outerHost)
    const innerSubgraph = createTestSubgraph({ rootGraph: graph })
    const innerHost = createTestSubgraphNode(innerSubgraph, {
      parentGraph: outerSubgraph
    })
    outerSubgraph.add(innerHost)
    innerSubgraph.add(node)
    widget('loras').value = 2
    const strength = widget('loras.1.strength')
    expect(
      promoteValueWidgetViaSubgraphInput(innerHost, node, strength).ok
    ).toBe(true)
    const innerPromoted = promotedInputWidget(innerHost.inputs[0])
    if (!innerPromoted) throw new Error('Inner promotion failed')
    expect(
      promoteValueWidgetViaSubgraphInput(outerHost, innerHost, innerPromoted).ok
    ).toBe(true)
    const outerInput = outerHost.inputs[0]
    expect(promotedInputWidget(outerInput)?.label).toBe('LoRA #2 strength')
    return { widget, innerHost, outerSubgraph, outerInput }
  }

  it.for([
    { label: 'LoRA #2 strength', expected: 'LoRA #1 strength' },
    { label: 'My strength', expected: 'My strength' }
  ])(
    'shows $expected through two boundaries after removing a row before the promoted field $label',
    ({ label, expected }) => {
      const { widget, outerSubgraph, outerInput } = setupTwiceDeepPromotion()
      outerSubgraph.renameInput(outerSubgraph.inputs[0], label)

      widget('loras.0').callback?.(undefined)

      expect(promotedInputWidget(outerInput)?.label).toBe(expected)
    }
  )

  it('removes a field promoted through two boundaries when its row is removed', async () => {
    const { widget, innerHost, outerInput } = setupTwiceDeepPromotion()

    widget('loras.1').callback?.(undefined)
    await Promise.resolve()

    expect(innerHost.inputs[0].link).toBeNull()
    expect(promotedInputWidget(outerInput)).toBeNull()
  })

  it.for([
    { label: 'LoRA #2 strength', expected: 'LoRA 1행 strength' },
    { label: 'My strength', expected: 'My strength' }
  ])(
    'renumbers $label after restoring in another language',
    ({ label, expected }) => {
      const { node, widget } = setup()
      widget('loras').value = 2
      widget('loras.1.strength').label = label
      node.inputs[node.findInputSlot('loras.1.strength')].label = label
      const saved = node.serialize()
      const locale = i18n.global.locale.value
      const messages = cloneDeep(i18n.global.getLocaleMessage('ko'))
      onTestFinished(() => {
        i18n.global.locale.value = locale
        i18n.global.setLocaleMessage('ko', messages)
      })
      i18n.global.mergeLocaleMessage('ko', {
        dynamicGroup: { row: '{group} {index}행' }
      })
      i18n.global.locale.value = 'ko'
      const restored = setup()
      restored.node.configure(saved)

      restored.widget('loras.0').callback?.(undefined)

      expect(restored.widget('loras.0.strength').label).toBe(expected)
      expect(restored.widget('loras.0').label).toBe('LoRA 1행')
    }
  )

  it('keeps group controls off the canvas while preserving Vue editing and saved values', () => {
    const { node, widget } = setup(1)
    widget('loras.$add').callback?.(undefined)
    widget('loras.1.lora_name').value = 'C'
    widget('loras.1.strength').label = 'My strength'
    node.inputs[node.findInputSlot('loras.1.strength')].label = 'My strength'
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
    expect(restored.widget('loras.1.strength').label).toBe('My strength')
    restored.widget('loras.0').callback?.(undefined)
    expect(restored.widget('loras.0.lora_name').value).toBe('C')
    expect(restored.widget('loras.0.strength').label).toBe('My strength')
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
