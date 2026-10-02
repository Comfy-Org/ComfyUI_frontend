import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import {
  addValueControlWidget,
  addValueControlWidgets
} from '@/scripts/widgets'

/**
 * `control_after_generate` means two things on one key, and the frontend used
 * to resolve the ambiguity by type alone: any string became the control
 * widget's *name*. Core's V3 `io.ControlAfterGenerate` is a `str` Enum, so
 * `object_info` now carries the control's *mode* there — and
 * `zIntInputOptions` already declares the string form as that enum, not a
 * name. These cases pin which strings are names and which are modes.
 */

/** A node left as the int widget constructor leaves it, before the control. */
function intNode() {
  const graph = new LGraph()
  const node = new LGraphNode('PrimitiveInt')
  node.serialize_widgets = true
  graph.add(node)
  const target = node.addWidget('number', 'value', 0, () => {})
  return { node, target }
}

const intSpec = (options: Record<string, unknown>) =>
  ['INT', options] as unknown as InputSpec

describe('value control widget naming', () => {
  it('reads a ControlAfterGenerate mode as the mode, not as the widget name', () => {
    // `comfy_extras/nodes_primitive.py` declares
    // `control_after_generate=io.ControlAfterGenerate.fixed`.
    const { node, target } = intNode()

    const control = addValueControlWidget(
      node,
      target,
      'fixed',
      undefined,
      undefined,
      intSpec({ control_after_generate: 'fixed' })
    )

    expect(control.name).toBe('control_after_generate')
    expect(control.value).toBe('fixed')
    expect(node.widgets?.map((widget) => widget.name)).toEqual([
      'value',
      'control_after_generate'
    ])
  })

  it.for(['increment', 'decrement', 'randomize'] as const)(
    'reads the %s mode as the mode too',
    (mode) => {
      const { node, target } = intNode()

      const control = addValueControlWidget(
        node,
        target,
        mode,
        undefined,
        undefined,
        intSpec({ control_after_generate: mode })
      )

      expect(control.name).toBe('control_after_generate')
      expect(control.value).toBe(mode)
    }
  )

  it('still honours a group node’s prefixed name override', () => {
    // `groupNode.ts` writes `${prefix}control_after_generate` so a flattened
    // node’s controls stay distinct from each other.
    const { node, target } = intNode()

    const control = addValueControlWidget(
      node,
      target,
      'randomize',
      undefined,
      undefined,
      intSpec({ control_after_generate: 'Sampler control_after_generate' })
    )

    expect(control.name).toBe('Sampler control_after_generate')
  })

  it('still honours the control_prefix form alongside the boolean flag', () => {
    const { node, target } = intNode()

    const control = addValueControlWidget(
      node,
      target,
      'randomize',
      undefined,
      undefined,
      intSpec({ control_after_generate: true, control_prefix: 'Sampler' })
    )

    expect(control.name).toBe('Sampler control_after_generate')
  })

  it('prefers the caller’s widgetName over a mode in the spec', () => {
    const { node, target } = intNode()

    const control = addValueControlWidget(
      node,
      target,
      'fixed',
      undefined,
      'Sampler control_after_generate',
      intSpec({ control_after_generate: 'fixed' })
    )

    expect(control.name).toBe('Sampler control_after_generate')
  })

  it('names the combo control canonically when the spec carries a mode', () => {
    // `useComboWidget` calls `addValueControlWidgets` directly, so the
    // name resolution inside `getName` is the only guard on that path.
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.serialize_widgets = true
    graph.add(node)
    const target = node.addWidget('combo', 'ckpt_name', 'a', () => {}, {
      values: ['a', 'b']
    })

    const [control, filter] = addValueControlWidgets(
      node,
      target,
      'randomize',
      undefined,
      intSpec({ control_after_generate: 'randomize' })
    )

    expect(control.name).toBe('control_after_generate')
    expect(filter.name).toBe('control_filter_list')
  })

  it('still honours a name override for the filter list', () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.serialize_widgets = true
    graph.add(node)
    const target = node.addWidget('combo', 'ckpt_name', 'a', () => {}, {
      values: ['a', 'b']
    })

    const [, filter] = addValueControlWidgets(
      node,
      target,
      'randomize',
      undefined,
      intSpec({
        control_after_generate: 'fixed',
        control_filter_list: 'Loader control_filter_list'
      })
    )

    expect(filter.name).toBe('Loader control_filter_list')
  })
})
