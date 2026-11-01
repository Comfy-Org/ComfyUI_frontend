import { assert, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetStore } from '@/stores/widgetStore'
import { graphToPrompt } from '@/utils/executionUtil'

import { dynamicPromptsExtension as extension } from './dynamicPrompts'

function createDynamicNode(
  dynamicPrompts: boolean | undefined,
  multiline = false,
  widgetType?: string
) {
  const graph = new LGraph()
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
  const node = new LGraphNode('DynamicPromptTest')
  node.comfyClass = 'DynamicPromptTest'
  node.serialize_widgets = true
  graph.add(node)
  const text: InputSpec = [
    'STRING',
    { default: 'hello /*hidden*/world', multiline, dynamicPrompts, widgetType }
  ]
  const secondText: InputSpec = [
    'STRING',
    {
      default: 'second /*hidden*/option',
      multiline,
      dynamicPrompts,
      widgetType
    }
  ]
  useLitegraphService().addNodeInput(
    node,
    transformInputSpecV1ToV2(
      [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'first', inputs: { required: { text } } },
            { key: 'second', inputs: { required: { text: secondText } } }
          ]
        }
      ],
      { name: 'mode', isOptional: false }
    )
  )
  extension.nodeCreated?.(node, app)
  const combo = node.widgets?.find((widget) => widget.name === 'mode')
  assert.exists(combo)
  return { node, graph, combo }
}

describe('dynamic prompt serialization', () => {
  it('expands the initial option without changing the source value', async () => {
    const { graph, node } = createDynamicNode(true)

    const { output } = await graphToPrompt(graph)

    expect(output[String(node.id)].inputs).toEqual({
      mode: 'first',
      'mode.text': 'hello world'
    })
    expect(
      node.widgets?.find((widget) => widget.name === 'mode.text')?.value
    ).toBe('hello /*hidden*/world')
  })

  it.for([
    {
      name: 'reselected option',
      selected: 'first',
      multiline: false,
      expected: 'hello world',
      raw: 'hello /*hidden*/world'
    },
    {
      name: 'switched option',
      selected: 'second',
      multiline: false,
      expected: 'second option',
      raw: 'second /*hidden*/option'
    },
    {
      name: 'switched multiline option',
      selected: 'second',
      multiline: true,
      expected: 'second option',
      raw: 'second /*hidden*/option'
    }
  ])(
    'expands a dynamic string in the $name',
    async ({ selected, multiline, expected, raw }) => {
      const { graph, node, combo } = createDynamicNode(true, multiline)
      combo.value = selected

      const { output } = await graphToPrompt(graph)

      expect(output[String(node.id)].inputs).toEqual({
        mode: selected,
        'mode.text': expected
      })
      expect(
        node.widgets?.find((widget) => widget.name === 'mode.text')?.value
      ).toBe(raw)
    }
  )

  it('expands the first option after switching away and back', async () => {
    const { graph, node, combo } = createDynamicNode(true)
    combo.value = 'second'
    combo.value = 'first'

    const { output } = await graphToPrompt(graph)

    expect(output[String(node.id)].inputs).toEqual({
      mode: 'first',
      'mode.text': 'hello world'
    })
  })

  it.for([
    { name: 'disabled', dynamicPrompts: false },
    { name: 'ordinary', dynamicPrompts: undefined }
  ])('preserves a $name string after switching', async ({ dynamicPrompts }) => {
    const { graph, node, combo } = createDynamicNode(dynamicPrompts)
    combo.value = 'second'

    const { output } = await graphToPrompt(graph)

    expect(output[String(node.id)].inputs).toEqual({
      mode: 'second',
      'mode.text': 'second /*hidden*/option'
    })
  })

  it.for([
    { name: 'enabled', dynamicPrompts: true, expected: 'second option' },
    {
      name: 'disabled',
      dynamicPrompts: false,
      expected: 'custom serialization'
    },
    {
      name: 'ordinary',
      dynamicPrompts: undefined,
      expected: 'custom serialization'
    }
  ])(
    'preserves $name custom serialization after repeated reconstruction and queues',
    async ({ dynamicPrompts, expected }) => {
      useWidgetStore().registerCustomWidgets({
        CUSTOM_DYNAMIC_OPTION: (target, name, inputData) => {
          const widget = target.addWidget(
            'text',
            name,
            inputData[1]?.default ?? '',
            () => {},
            {}
          )
          widget.dynamicPrompts = dynamicPrompts
          widget.serializeValue = () => 'custom serialization'
          return widget
        }
      })
      const { graph, node, combo } = createDynamicNode(
        dynamicPrompts,
        false,
        'CUSTOM_DYNAMIC_OPTION'
      )
      combo.value = 'second'
      combo.value = 'first'
      combo.value = 'second'

      const firstQueue = await graphToPrompt(graph)
      const secondQueue = await graphToPrompt(graph)

      expect(firstQueue.output[String(node.id)].inputs).toEqual({
        mode: 'second',
        'mode.text': expected
      })
      expect(secondQueue.output[String(node.id)].inputs).toEqual({
        mode: 'second',
        'mode.text': expected
      })
      expect(
        node.widgets?.find((widget) => widget.name === 'mode.text')?.value
      ).toBe('second /*hidden*/option')
      expect(secondQueue.workflow.nodes[0].widgets_values).toEqual([
        'second',
        'second /*hidden*/option'
      ])
    }
  )

  it.for([
    { name: 'enabled', dynamicPrompts: true, expected: 'extra prompt' },
    { name: 'disabled', dynamicPrompts: false, expected: 'extra custom' },
    { name: 'ordinary', dynamicPrompts: undefined, expected: 'extra custom' }
  ])(
    'serializes every custom widget with an $name companion after reconstruction',
    async ({ dynamicPrompts, expected }) => {
      useWidgetStore().registerCustomWidgets({
        CUSTOM_MULTIPLE_TEXT: (target, name, inputData) => {
          const primary = target.addWidget(
            'text',
            name,
            inputData[1]?.default ?? '',
            () => {},
            {}
          )
          primary.dynamicPrompts = true
          const extra = target.addWidget(
            'text',
            `${name}.extra`,
            'extra /*hidden*/prompt',
            () => {},
            {}
          )
          extra.dynamicPrompts = dynamicPrompts
          extra.serializeValue = () => 'extra custom'
          return primary
        }
      })
      const { graph, node, combo } = createDynamicNode(
        true,
        false,
        'CUSTOM_MULTIPLE_TEXT'
      )
      const retained = node.addWidget(
        'text',
        'retained',
        'retained /*hidden*/template',
        () => {},
        {}
      )
      retained.dynamicPrompts = true
      retained.serializeValue = () => 'retained custom'
      combo.value = 'second'
      combo.value = 'first'
      combo.value = 'second'

      const firstQueue = await graphToPrompt(graph)
      const secondQueue = await graphToPrompt(graph)

      expect(firstQueue.output[String(node.id)].inputs).toEqual({
        mode: 'second',
        'mode.text': 'second option',
        'mode.text.extra': expected,
        retained: 'retained custom'
      })
      expect(secondQueue.output[String(node.id)].inputs).toEqual(
        firstQueue.output[String(node.id)].inputs
      )
      expect(secondQueue.workflow.nodes[0].widgets_values).toEqual([
        'second',
        'second /*hidden*/option',
        'extra /*hidden*/prompt',
        'retained /*hidden*/template'
      ])
    }
  )

  it('binds a custom widget returned without adding it to the node', () => {
    const node = new LGraphNode('DetachedCustomPromptTest')
    const widget: IBaseWidget = {
      name: 'prompt',
      type: 'text',
      value: 'detached /*hidden*/prompt',
      options: {},
      y: 0,
      dynamicPrompts: true
    }
    useWidgetStore().registerCustomWidgets({
      CUSTOM_DETACHED_TEXT: () => widget
    })

    useLitegraphService().addNodeInput(node, {
      name: 'prompt',
      type: 'STRING',
      widgetType: 'CUSTOM_DETACHED_TEXT',
      isOptional: false
    })

    assert.exists(widget.serializeValue)
    expect(widget.serializeValue(node, 0)).toBe('detached prompt')
    expect(widget.value).toBe('detached /*hidden*/prompt')
  })

  it.for([
    { dynamicPrompts: true, expected: 'hello world' },
    { dynamicPrompts: false, expected: 'custom serialization' }
  ])(
    'preserves custom widget opt-in $dynamicPrompts',
    async ({ dynamicPrompts, expected }) => {
      const graph = new LGraph()
      const node = new LGraphNode('CustomDynamicPromptTest')
      node.comfyClass = 'CustomDynamicPromptTest'
      graph.add(node)
      useWidgetStore().registerCustomWidgets({
        CUSTOM_DYNAMIC_TEXT: (target, name) => {
          const widget = target.addWidget(
            'text',
            name,
            'hello /*hidden*/world',
            () => {},
            {}
          )
          widget.dynamicPrompts = dynamicPrompts
          widget.serializeValue = () => 'custom serialization'
          return widget
        }
      })
      useLitegraphService().addNodeInput(node, {
        name: 'prompt',
        type: 'STRING',
        widgetType: 'CUSTOM_DYNAMIC_TEXT',
        isOptional: false
      })
      extension.nodeCreated?.(node, app)

      const { output } = await graphToPrompt(graph)

      expect(output[String(node.id)].inputs).toEqual({ prompt: expected })
    }
  )
})
