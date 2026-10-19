import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import type { useExtensionService } from '@/services/extensionService'
import { useWidgetStore } from '@/stores/widgetStore'
import { graphToPrompt } from '@/utils/executionUtil'

const extensions = await vi.hoisted(async () => {
  const { createExtensionCapture } =
    await import('@/utils/__tests__/extensionTestUtils')
  return createExtensionCapture()
})

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: extensions.registerExtension
    })
}))

await import('./dynamicPrompts')
const extension = extensions.getExtension('Comfy.DynamicPrompts')

function createDynamicNode(
  dynamicPrompts: boolean | undefined,
  multiline = false
) {
  const graph = new LGraph()
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
  const node = new LGraphNode('DynamicPromptTest')
  node.comfyClass = 'DynamicPromptTest'
  node.serialize_widgets = true
  graph.add(node)
  const text: InputSpec = [
    'STRING',
    { default: 'hello /*hidden*/world', multiline, dynamicPrompts }
  ]
  useLitegraphService().addNodeInput(
    node,
    transformInputSpecV1ToV2(
      [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'first', inputs: { required: { text } } },
            { key: 'second', inputs: { required: { text } } }
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
    { name: 'reselected option', selected: 'first', multiline: false },
    { name: 'switched option', selected: 'second', multiline: false },
    { name: 'switched multiline option', selected: 'second', multiline: true }
  ])(
    'expands a dynamic string in the $name',
    async ({ selected, multiline }) => {
      const { graph, node, combo } = createDynamicNode(true, multiline)
      combo.value = selected

      const { output } = await graphToPrompt(graph)

      expect(output[String(node.id)].inputs).toEqual({
        mode: selected,
        'mode.text': 'hello world'
      })
      expect(
        node.widgets?.find((widget) => widget.name === 'mode.text')?.value
      ).toBe('hello /*hidden*/world')
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
      'mode.text': 'hello /*hidden*/world'
    })
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
