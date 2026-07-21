import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

function createNode() {
  const node = new LGraphNode('TestNode')
  node.serialize_widgets = true
  return node
}

function roundTrip(source: LGraphNode, build: (node: LGraphNode) => void) {
  const serialized = source.serialize()
  const target = createNode()
  build(target)
  target.configure(serialized)
  return target
}

describe('LGraphNode widget serialization round-trip', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('round-trips values when a non-serialized widget sits between serialized ones', () => {
    const build = (node: LGraphNode) => {
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('button', 'action', 'Click', null, {})
      node.widgets![1].serialize = false
      node.addWidget('number', 'seed', 0, null, {})
    }

    const source = createNode()
    build(source)
    source.widgets![0].value = 30
    source.widgets![2].value = 12345

    const restored = roundTrip(source, build)

    expect(restored.widgets![0].value).toBe(30)
    expect(restored.widgets![2].value).toBe(12345)
  })

  it('round-trips values when the first widget is non-serialized', () => {
    const build = (node: LGraphNode) => {
      node.addWidget('button', 'action', 'Click', null, {})
      node.widgets![0].serialize = false
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('text', 'prompt', '', null, {})
    }

    const source = createNode()
    build(source)
    source.widgets![1].value = 30
    source.widgets![2].value = 'a prompt'

    const restored = roundTrip(source, build)

    expect(restored.widgets![1].value).toBe(30)
    expect(restored.widgets![2].value).toBe('a prompt')
  })

  it('round-trips every primitive widget type', () => {
    const build = (node: LGraphNode) => {
      node.addWidget('number', 'steps', 20, null, {})
      node.addWidget('text', 'prompt', '', null, {})
      node.addWidget('toggle', 'enabled', false, null, {})
      node.addWidget('combo', 'sampler', 'euler', null, {
        values: ['euler', 'ddim', 'dpm']
      })
    }

    const source = createNode()
    build(source)
    source.widgets![0].value = 42
    source.widgets![1].value = 'a prompt'
    source.widgets![2].value = true
    source.widgets![3].value = 'ddim'

    const restored = roundTrip(source, build)

    expect(restored.widgets!.map((w) => w.value)).toEqual([
      42,
      'a prompt',
      true,
      'ddim'
    ])
  })
})
