import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'

class TestNode extends LGraphNode {
  constructor(widgets: IBaseWidget[]) {
    super('TestNode')
    this.widgets = widgets
  }
}

function createWidget(name: string): IBaseWidget {
  return {
    name,
    type: 'text',
    y: 0,
    options: {}
  }
}

describe('resolveWidgetFromHostNode', () => {
  it('returns the host node widget matching the name', () => {
    const widget = createWidget('text_widget')
    const hostNode = new TestNode([widget])

    expect(resolveWidgetFromHostNode(hostNode, widget.name)).toEqual({
      node: hostNode,
      widget
    })
  })

  it('returns undefined when no widget matches the name', () => {
    const hostNode = new TestNode([createWidget('other')])

    expect(resolveWidgetFromHostNode(hostNode, 'missing')).toBeUndefined()
  })

  it('returns undefined when the host node is undefined', () => {
    expect(resolveWidgetFromHostNode(undefined, 'anything')).toBeUndefined()
  })
})
