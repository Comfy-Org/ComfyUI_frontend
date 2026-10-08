import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { useNodeProgressText } from './useNodeProgressText'

const textPreviewWidget = vi.hoisted(() =>
  vi.fn((_node: unknown, options: { name: string }) => ({
    name: options.name,
    value: ''
  }))
)

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget',
  () => ({
    useTextPreviewWidget: () => textPreviewWidget
  })
)

describe('useNodeProgressText', () => {
  it('adds a text preview widget and assigns the text', () => {
    const node = new LGraphNode('test')

    useNodeProgressText().showTextPreview(node, 'running')

    expect(textPreviewWidget).toHaveBeenCalledTimes(1)
    expect(textPreviewWidget).toHaveBeenCalledWith(node, {
      name: '$$node-text-preview',
      type: 'progressText'
    })
    expect(textPreviewWidget.mock.results[0]?.value).toMatchObject({
      value: 'running'
    })
  })

  it('reuses an existing text preview widget instead of adding another', () => {
    const node = new LGraphNode('test')
    const existing = node.addWidget(
      'text',
      '$$node-text-preview',
      '',
      () => undefined,
      {}
    )

    useNodeProgressText().showTextPreview(node, 'still running')

    expect(textPreviewWidget).not.toHaveBeenCalled()
    expect(existing.value).toBe('still running')
  })

  it('deletes the text preview widget store entry on removal', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.addWidget('text', '$$node-text-preview', '', () => undefined, {})

    const store = useWidgetValueStore()
    const previewId = widgetId(graph.id, node.id, '$$node-text-preview')
    expect(store.getWidget(previewId)).toBeDefined()

    useNodeProgressText().removeTextPreview(node)

    expect(node.widgets).toHaveLength(0)
    expect(store.getWidget(previewId)).toBeUndefined()
  })

  it('leaves other widgets untouched on removal', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.addWidget('text', 'user-widget', 'kept', () => undefined, {})
    node.addWidget('text', '$$node-text-preview', '', () => undefined, {})

    const store = useWidgetValueStore()
    const userId = widgetId(graph.id, node.id, 'user-widget')

    useNodeProgressText().removeTextPreview(node)

    expect(node.widgets?.map((w) => w.name)).toEqual(['user-widget'])
    expect(store.getWidget(userId)).toBeDefined()
  })

  it('no-ops on removal when the node has no widgets', () => {
    const node = new LGraphNode('test')

    expect(() => useNodeProgressText().removeTextPreview(node)).not.toThrow()
  })
})
