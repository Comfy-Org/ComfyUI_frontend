import { describe, expect, it } from 'vitest'

import {
  ComparerWidget,
  serialiseComparerWidgetValues
} from '@/lib/litegraph/src/__fixtures__/legacyDoNotReplicate'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

class ImageComparerNode extends LGraphNode {
  static override title = 'ImageComparer'

  constructor() {
    super('ImageComparer')
    this.serialize_widgets = true
    this.addCustomWidget(new ComparerWidget())
  }

  override onSerialize(data: ISerialisedNode) {
    serialiseComparerWidgetValues(this, data)
  }
}

LiteGraph.registerNodeType('test/ImageComparer', ImageComparerNode)

/**
 * Regression: adopting a custom widget replaced its normalising `value` getter
 * with the store-backed one, so a widget that accepts a list but reads back an
 * object handed the list straight back. The comparer node's `onSerialize` then
 * threw `can't access property "map", value.images is undefined` while
 * serialising the graph — on every workflow switch, not just on save.
 */
describe('custom widget owning its value behind an accessor pair', () => {
  it('reads back the widget-owned shape after configure and serialize', () => {
    const graph = new LGraph()
    const node = new ImageComparerNode()
    graph.add(node)

    const images = [
      { url: 'a.png', name: 'A', selected: true },
      { url: 'b.png', name: 'B', selected: true }
    ]
    node.configure({
      id: node.id,
      type: 'test/ImageComparer',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      widgets_values: [images]
    })

    expect(node.serialize().widgets_values).toEqual([images])
    expect(node.widgets![0].value).toEqual({ images })
  })
})
