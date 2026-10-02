import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { CONTROL_OPTIONS } from '@/types/simplifiedWidget'
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

/** The combo equivalent, which also gets a filter-list widget. */
function comboNode() {
  const graph = new LGraph()
  const node = new LGraphNode('CheckpointLoaderSimple')
  node.serialize_widgets = true
  graph.add(node)
  const target = node.addWidget('combo', 'ckpt_name', 'a', () => {}, {
    values: ['a', 'b']
  })
  return { node, target }
}

/**
 * `['INT', options]`, the V1 spec shape the widget constructors receive. The
 * options bag stays loose on purpose: the group-node name override is not
 * declarable on `zIntInputOptions` (which types the key as the
 * `ControlAfterGenerate` enum), because `groupNode.ts` injects that form at
 * runtime rather than reading it from `object_info`.
 */
const intSpec = (options: Record<string, unknown>) =>
  ['INT', options] as InputSpec

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

  it('seats a mode when the caller forwards a name override as the value', () => {
    // `useIntWidget` derives its `defaultValue` from the same overloaded key,
    // so a name override reaches here as the control's value. Seating it would
    // leave `nextValueForLinkedTarget` with no matching case and the target
    // would never advance.
    const { node, target } = intNode()
    const spec = intSpec({
      control_after_generate: 'Sampler control_after_generate'
    })

    const control = addValueControlWidget(
      node,
      target,
      'Sampler control_after_generate',
      undefined,
      undefined,
      spec
    )

    expect(control.name).toBe('Sampler control_after_generate')
    expect(control.value).toBe('randomize')
  })

  it('treats a blank name override as absent', () => {
    const { node, target } = intNode()

    const control = addValueControlWidget(
      node,
      target,
      'fixed',
      undefined,
      undefined,
      intSpec({ control_after_generate: '  ', control_prefix: 'Sampler' })
    )

    expect(control.name).toBe('Sampler control_after_generate')
  })

  it('offers every declared mode on the control, plus the combo-only one', () => {
    // The mode list that decides name-versus-mode must stay the same list the
    // widget actually offers, or a new mode is read as a name again.
    const { node: intHost, target: intTarget } = intNode()
    const intControl = addValueControlWidget(
      intHost,
      intTarget,
      'fixed',
      undefined,
      undefined,
      intSpec({ control_after_generate: 'fixed' })
    )
    const { node: comboHost, target: comboTarget } = comboNode()
    const [comboControl] = addValueControlWidgets(
      comboHost,
      comboTarget,
      'fixed',
      undefined,
      intSpec({ control_after_generate: 'fixed' })
    )

    expect(intControl.options.values).toEqual(CONTROL_OPTIONS)
    expect(comboControl.options.values).toEqual([
      ...CONTROL_OPTIONS,
      'increment-wrap'
    ])
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

  // `increment-wrap` is combo-only: `addValueControlWidgets` pushes it into
  // the control's own `values` when the target is a combo, so it is a mode
  // even though the schema enum does not list it.
  it.for(['randomize', 'increment-wrap'] as const)(
    'names the combo control canonically when the spec carries the %s mode',
    (mode) => {
      // `useComboWidget` calls `addValueControlWidgets` directly, so the name
      // resolution inside `getName` is the only guard on that path.
      const { node, target } = comboNode()

      const [control, filter] = addValueControlWidgets(
        node,
        target,
        mode,
        undefined,
        intSpec({ control_after_generate: mode })
      )

      expect(control.name).toBe('control_after_generate')
      expect(control.value).toBe(mode)
      expect(filter.name).toBe('control_filter_list')
    }
  )

  it('still honours a name override for the filter list', () => {
    const { node, target } = comboNode()

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
