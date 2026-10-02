import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec, IntInputSpec } from '@/schemas/nodeDefSchema'
import { CONTROL_OPTIONS } from '@/types/simplifiedWidget'
import {
  addValueControlWidget,
  addValueControlWidgets
} from '@/scripts/widgets'

function intNode() {
  const graph = new LGraph()
  const node = new LGraphNode('PrimitiveInt')
  node.serialize_widgets = true
  graph.add(node)
  const target = node.addWidget('number', 'value', 0, () => {})
  return { node, target }
}

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

const intSpec = (options: IntInputSpec[1]): InputSpec => ['INT', options]

/** Loose on purpose: `InputSpec` cannot express a group-node name override. */
const looseIntSpec = (options: Record<string, unknown>) =>
  ['INT', options] as InputSpec

describe('value control widget naming', () => {
  it.for(['fixed', 'increment', 'decrement', 'randomize'] as const)(
    'reads the %s mode as the mode, not as the widget name',
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
    const { node, target } = intNode()

    const control = addValueControlWidget(
      node,
      target,
      'randomize',
      undefined,
      undefined,
      looseIntSpec({
        control_after_generate: 'Sampler control_after_generate'
      })
    )

    expect(control.name).toBe('Sampler control_after_generate')
  })

  it('seats a mode when the caller forwards a name override as the value', () => {
    const { node, target } = intNode()
    const spec = looseIntSpec({
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
      looseIntSpec({
        control_after_generate: '  ',
        control_prefix: 'Sampler'
      })
    )

    expect(control.name).toBe('Sampler control_after_generate')
  })

  it('offers every declared mode on the control, plus the combo-only one', () => {
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

  it.for(['randomize', 'increment-wrap'] as const)(
    'names the combo control canonically when the spec carries the %s mode',
    (mode) => {
      const { node, target } = comboNode()

      const [control, filter] = addValueControlWidgets(
        node,
        target,
        mode,
        undefined,
        looseIntSpec({ control_after_generate: mode })
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
