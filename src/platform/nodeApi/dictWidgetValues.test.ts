import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

/**
 * Widget values are keyed by name at runtime — `widgetValueStore` is keyed by
 * `graphId:nodeId:name`, with no index in the identity. The positional
 * `widgets_values` array is only the legacy serialized form, which is why it is
 * reserved.
 *
 * A pack that wrote a name-keyed dict into that key was therefore not fighting
 * the architecture; it was reaching, through the only opening available, for
 * what the model now provides. Converting it means deleting the override, not
 * translating the format — and still reading the old shape back.
 */
describe('a name-keyed widgets_values on load', () => {
  let node: LGraphNode
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('VHS_VideoCombine')
    node.addWidget('number', 'frame_rate', 8, () => {})
    node.addWidget('text', 'filename_prefix', 'out', () => {})
    node.serialize_widgets = true
    graph.add(node)
  })

  it('reaches onConfigure intact, core having applied none of it', () => {
    let seen: unknown
    node.onConfigure = (info) => {
      seen = (info as { widgets_values?: unknown }).widgets_values
    }

    node.configure({
      id: node.id,
      type: 'VHS_VideoCombine',
      widgets_values: { frame_rate: 24, filename_prefix: 'video/%date:yyyy%' }
    } as never)

    // Core's positional pass cannot index a plain object, so it applies
    // nothing and the widget keeps what it had. Restoring the saved values is
    // therefore onConfigure's job, which is why the dict has to arrive intact.
    expect(node.widgets![0].value).toBe(8)
    expect(seen).toEqual({
      frame_rate: 24,
      filename_prefix: 'video/%date:yyyy%'
    })
  })

  it('can still carry a pack-owned key, though it rarely needs to', () => {
    // Kept because a pack may have its own state that is genuinely not widget
    // values. For widget values themselves this is unnecessary: name-keyed
    // access is native, so the pack simply stops overwriting the array.
    const saved = node.serialize() as unknown as Record<string, unknown>
    const packKey = Object.fromEntries(
      (node.widgets ?? []).map((w) => [w.name, w.value])
    )
    const withPackKey = { ...saved, vhs_widget_values: packKey }

    let seen: unknown
    node.onConfigure = (info) => {
      seen = (info as unknown as Record<string, unknown>).vhs_widget_values
    }
    node.configure(withPackKey as never)

    expect(saved.widgets_values).toEqual([8, 'out'])
    expect(seen).toEqual({ frame_rate: 8, filename_prefix: 'out' })
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
