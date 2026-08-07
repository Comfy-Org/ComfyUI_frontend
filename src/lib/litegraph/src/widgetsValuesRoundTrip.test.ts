/**
 * `widgets_values` survives a save/load round trip.
 *
 * `serialize()` writes each value at the widget's own index, so a widget that
 * opts out of persistence leaves a hole. Reading back compacted shifted every
 * later value by one, which silently replaced a saved value with the hole's
 * `null`. Nobody hit it because previews are appended last, where the two
 * layouts coincide — and `widgets.mount()` is what changed that.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

function nodeWith(shape: readonly ('keep' | 'drop')[], graph: LGraph) {
  const node = new LGraphNode('T', 'TestNode')
  graph.add(node)
  node.serialize_widgets = true
  shape.forEach((kind, i) => {
    node.addWidget('number', `w${i}`, i * 10, () => {}, {})
    if (kind === 'drop') node.widgets![i].serialize = false
  })
  return node
}

describe('widgets_values round trip', () => {
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
  })

  const shapes = [
    ['keep', 'keep'],
    ['drop', 'keep'],
    ['keep', 'drop'],
    ['drop', 'keep', 'drop', 'keep'],
    ['keep', 'drop', 'keep']
  ] as const

  for (const shape of shapes) {
    it(`restores every persisted value for [${shape.join(',')}]`, () => {
      const saved = nodeWith(shape, graph)
      const expected = saved.widgets!.map((w) =>
        w.serialize === false ? undefined : w.value
      )

      const wire = JSON.parse(JSON.stringify(saved.serialize()))
      const loaded = nodeWith(shape, graph)
      for (const w of loaded.widgets!) w.value = -1
      loaded.configure(wire)

      const actual = loaded.widgets!.map((w) =>
        w.serialize === false ? undefined : w.value
      )
      expect(actual).toEqual(expected)
    })
  }

  it('still reads a compacted array, which is what older data holds', () => {
    // The layout PR #921 enshrined: values for the persisted widgets only.
    const node = nodeWith(['drop', 'keep'], graph)
    node.configure({ widgets_values: [100] } as never)

    expect(node.widgets![0].value).toBe(0)
    expect(node.widgets![1].value).toBe(100)
  })
})
