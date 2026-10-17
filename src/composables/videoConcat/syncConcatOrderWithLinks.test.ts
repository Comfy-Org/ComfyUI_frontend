import { assert, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { addAutogrow } from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IVideoConcatWidget
} from '@/lib/litegraph/src/types/widgets'
import { useVideoConcatWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useVideoConcatWidget'

function isVideoConcatWidget(
  widget: IBaseWidget
): widget is IVideoConcatWidget {
  return widget.type === 'videoconcat'
}

function animationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function buildConcat({ widgetBeforeAdding = false } = {}) {
  const graph = new LGraph()
  const concat = new LGraphNode('ConcatenateVideo')
  if (!widgetBeforeAdding) graph.add(concat)
  addAutogrow(concat, {
    input: { required: { video: ['VIDEO', {}] } },
    prefix: 'video'
  })
  const widget = useVideoConcatWidget()(concat, {
    type: 'VIDEO_CONCAT',
    name: 'order',
    source: '0'
  })
  assert(isVideoConcatWidget(widget))
  if (widgetBeforeAdding) graph.add(concat)
  for (const [slot, title] of ['red', 'green', 'blue'].entries()) {
    const source = new LGraphNode(title)
    source.addOutput('VIDEO', 'VIDEO')
    graph.add(source)
    source.connect(0, concat, slot)
  }
  return { concat, widget }
}

function clipTitles(concat: LGraphNode, order: string[]) {
  return order.flatMap((name) => {
    const slot = concat.inputs.findIndex((input) => input.name === `0.${name}`)
    const title = slot < 0 ? undefined : concat.getInputNode(slot)?.title
    return title ? [title] : []
  })
}

describe('syncConcatOrderWithLinks', () => {
  it.for([{ widgetBeforeAdding: false }, { widgetBeforeAdding: true }])(
    'keeps every clip in its place when autogrow compacts slots after a disconnect (widget created before the node joins a graph: $widgetBeforeAdding)',
    async (options) => {
      const { concat, widget } = buildConcat(options)
      widget.value = { order: ['video2', 'video0', 'video1'] }
      await nextTick()
      expect(clipTitles(concat, widget.value.order ?? [])).toEqual([
        'blue',
        'red',
        'green'
      ])

      concat.disconnectInput(0)
      await animationFrame()
      await nextTick()

      expect(concat.inputs[0].name).toBe('0.video0')
      expect(clipTitles(concat, widget.value.order ?? [])).toEqual([
        'blue',
        'green'
      ])
      expect(widget.value.order).toEqual(['video1', 'video0'])
    }
  )

  it('stops following links once the node is removed', async () => {
    const { concat, widget } = buildConcat()
    widget.value = { order: ['video2', 'video0', 'video1'] }
    await nextTick()

    concat.onRemoved?.()
    concat.disconnectInput(0)
    await animationFrame()
    await nextTick()

    expect(widget.value.order).toEqual(['video2', 'video0', 'video1'])
  })
})
