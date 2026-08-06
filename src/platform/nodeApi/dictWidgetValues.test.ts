import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

describe('a dict-shaped widgets_values on load', () => {
  let node: LGraphNode
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    node = new LGraphNode('VHS_VideoCombine')
    node.addWidget('number', 'frame_rate', 8, () => {})
    node.addWidget('text', 'filename_prefix', 'out', () => {})
    node.serialize_widgets = true
    graph.add(node)
  })

  it('reaches onConfigure intact, after core has already scrambled the widgets', () => {
    let seen: unknown
    node.onConfigure = (info) => {
      seen = (info as { widgets_values?: unknown }).widgets_values
    }

    node.configure({
      id: node.id,
      type: 'VHS_VideoCombine',
      widgets_values: { frame_rate: 24, filename_prefix: 'video/%date:yyyy%' }
    } as never)

    // Core's positional pass indexes a plain object and writes undefined.
    // That is survivable only because onConfigure runs afterwards.
    expect(node.widgets![0].value).toBeUndefined()
    expect(seen).toEqual({
      frame_rate: 24,
      filename_prefix: 'video/%date:yyyy%'
    })
  })

  it('lets a converted pack restore by name and then save positionally', () => {
    node.onConfigure = (info) => {
      const dict = (info as { widgets_values?: Record<string, unknown> })
        .widgets_values
      if (!dict || Array.isArray(dict)) return
      for (const w of node.widgets ?? []) {
        if (w.name in dict) w.value = dict[w.name] as never
      }
    }

    node.configure({
      id: node.id,
      type: 'VHS_VideoCombine',
      widgets_values: { frame_rate: 24, filename_prefix: 'video/%date:yyyy%' }
    } as never)

    expect(node.widgets!.map((w) => w.value)).toEqual([24, 'video/%date:yyyy%'])
    // Saving now emits the standard positional form: the migration completes
    // on first save, with no core change and no new API.
    expect(node.serialize().widgets_values).toEqual([24, 'video/%date:yyyy%'])
  })
})
