import { describe, expect, it, vi } from 'vitest'

import type { DefaultConnectionColors } from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createNodeBox } from './createNodeBox'

const colourGetter: DefaultConnectionColors = {
  getConnectedColor: () => '#123456',
  getDisconnectedColor: () => 'invalid-colour'
}
const options = {
  colourGetter,
  getSlotPosition: (
    _node: LGraphNode,
    index: number,
    isInput: boolean
  ): [number, number] => [index + (isInput ? 10 : 20), index + 30],
  isSlotColorRenderable: (color: string) => color.startsWith('#'),
  widgetHeight: 20
}

function createExpandedNode(): LGraphNode {
  const node = new LGraphNode('Test')
  node.pos = [100, 200]
  node.size = [300, 160]
  node.addInput('model', 'MODEL')
  node.addOutput('image', 'IMAGE')
  vi.spyOn(node, 'isInputConnected').mockImplementation((index) => index === 0)

  const visibleWidget = node.addWidget('text', 'prompt', '', null, {
    callback: () => {}
  })
  visibleWidget.y = 60
  const hiddenWidget = node.addWidget('text', 'hidden', '', null, {
    callback: () => {}
  })
  hiddenWidget.hidden = true
  node.updateArea()
  return node
}

describe('createNodeBox', () => {
  it('projects expanded node details into the low-quality model', () => {
    const node = createExpandedNode()

    const box = createNodeBox(
      node,
      { body: '#101010', title: '#202020' },
      options
    )

    const [x, y, width, height] = node.boundingRect
    expect(box).toMatchObject({
      bounds: { x, y, width, height },
      color: '#101010',
      titleColor: '#202020',
      titleHeight: node.pos[1] - y
    })
    expect(box.slots).toHaveLength(2)
    expect(box.slots?.map(({ color }) => color)).toEqual(['#123456', undefined])
    expect(box.widgets).toEqual([
      {
        x: 115,
        y: 260,
        width: 270,
        height: 20
      }
    ])
  })

  it('uses collapsed geometry without hidden node details', () => {
    const node = createExpandedNode()
    node.flags.collapsed = true
    node.updateArea()

    const box = createNodeBox(node, undefined, options)
    const [x, y, width, height] = node.boundingRect

    expect(box).toEqual({
      bounds: { x, y, width, height },
      color: undefined,
      titleColor: undefined,
      titleHeight: node.pos[1] - y
    })
  })
})
