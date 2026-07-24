import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

interface MockWidget {
  name: string
  options: Record<string, unknown>
  value?: unknown
  serialize?: boolean
}

vi.mock('@/scripts/app', () => ({ app: { rootGraph: { id: 'graph-1' } } }))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  resolveNodeRootGraphId: () => 'graph-1'
}))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/components/WidgetTextPreview.vue',
  () => ({
    default: {}
  })
)

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({ getWidget: () => undefined })
}))

vi.mock('@/scripts/domWidget', () => ({
  ComponentWidgetImpl: class {
    name: string
    options: Record<string, unknown>
    type: string
    serialize?: boolean
    constructor(obj: {
      name: string
      options: Record<string, unknown>
      type: string
    }) {
      this.name = obj.name
      this.options = obj.options
      this.type = obj.type
    }
  },
  addWidget: (node: { widgets?: MockWidget[] }, widget: MockWidget) => {
    node.widgets = node.widgets ?? []
    node.widgets.push(widget)
  }
}))

vi.mock('@/scripts/widgets', () => ({
  ComfyWidgets: {
    BOOLEAN: (node: { widgets?: MockWidget[] }, name: string) => {
      const widget: MockWidget = { name, options: {}, value: false }
      node.widgets = node.widgets ?? []
      node.widgets.push(widget)
      return { widget }
    }
  }
}))

const { addTextPreviewWidgets, updateTextPreviewWidgets } =
  await import('./textPreviewWidgets')

function makeNode(): LGraphNode & { widgets: MockWidget[] } {
  return { id: '1', widgets: [] } as unknown as LGraphNode & {
    widgets: MockWidget[]
  }
}

describe('addTextPreviewWidgets', () => {
  it('adds a non-serialized preview widget and a non-serialized mode toggle', () => {
    const node = makeNode()
    addTextPreviewWidgets(node)

    const preview = node.widgets.find((w) => w.name === 'preview_text')
    const mode = node.widgets.find((w) => w.name === 'preview_mode')

    expect(preview?.type).toBe('textPreview')
    expect(preview?.serialize).toBe(false)
    expect(preview?.options.serialize).toBe(false)
    expect(mode?.options.serialize).toBe(false)
  })
})

describe('updateTextPreviewWidgets', () => {
  let node: LGraphNode & { widgets: MockWidget[] }

  beforeEach(() => {
    node = makeNode()
    node.widgets.push({ name: 'preview_text', options: {}, value: '' })
  })

  it('joins array text into the preview widget value', () => {
    updateTextPreviewWidgets(node, { text: ['a', 'b'] })
    expect(node.widgets[0].value).toBe('a\n\nb')
  })

  it('writes a plain string message as-is', () => {
    updateTextPreviewWidgets(node, { text: 'hello' })
    expect(node.widgets[0].value).toBe('hello')
  })

  it.each([
    ['null message', null],
    ['undefined message', undefined],
    ['message without text', {}],
    ['null text', { text: null }],
    ['array of only nulls', { text: [null, null] }]
  ])('renders empty and does not throw for %s', (_label, message) => {
    expect(() =>
      updateTextPreviewWidgets(node, message as { text?: string | string[] })
    ).not.toThrow()
    expect(node.widgets[0].value).toBe('')
  })

  it('drops null entries instead of rendering blank separators', () => {
    updateTextPreviewWidgets(node, {
      text: ['first', null, 'second']
    } as unknown as { text: string[] })

    expect(node.widgets[0].value).toBe('first\n\nsecond')
  })

  it('renders non-string values rather than blanking the node', () => {
    updateTextPreviewWidgets(node, { text: [30.0, 23.976] } as unknown as {
      text: string[]
    })

    expect(node.widgets[0].value).toBe('30\n\n23.976')
  })

  it.each([
    ['compact JSON', '{"name":"Comfy","emoji":"🌟"}'],
    [
      'pretty JSON',
      '{\n    "name": "Comfy",\n    "arr": [\n        1,\n        2\n    ]\n}'
    ],
    ['markdown-fenced JSON', '```json\n{"name":"Comfy"}\n```'],
    ['JSON array', '[{"a": 1}, {"b": 2}]'],
    ['non-ASCII text', '你好，世界。'],
    ['prompt with trailing space', '"A red car" is a great prompt. '],
    ['prompt ending in a quoted period', "ending in 'best quality.'"]
  ])('renders %s verbatim', (_label, text) => {
    updateTextPreviewWidgets(node, { text })
    expect(node.widgets[0].value).toBe(text)
  })

  it('does not throw when the node has no preview widget', () => {
    const bare = makeNode()
    expect(() =>
      updateTextPreviewWidgets(bare, { text: 'hello' })
    ).not.toThrow()
  })
})
