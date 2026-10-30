import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { proveWidgetForm } from '@/lib/litegraph/src/widgets/widgetFormProof'

function nodeInGraph(): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('test')
  node.serialize_widgets = true
  graph.add(node)
  return node
}

function coreIsLastWriter(node: LGraphNode): boolean {
  return (
    node.serialize === LGraphNode.prototype.serialize &&
    node.serializeFromStoreState ===
      LGraphNode.prototype.serializeFromStoreState
  )
}

function proveRealSerialization(node: LGraphNode) {
  const serialised = node.serialize()
  return {
    serialised,
    proof: proveWidgetForm(
      node.widgets,
      serialised,
      serialised.widgets_values,
      {
        serializeWidgets: node.serialize_widgets,
        coreIsLastWriter: coreIsLastWriter(node)
      }
    )
  }
}

describe('proveWidgetForm, driven through LGraphNode.serialize', () => {
  it('counts a widget flagged only in its options bag, because widgets_values does', () => {
    const node = nodeInGraph()
    node.addWidget('number', 'seed', 1, () => undefined, {})
    const optionsBagFlagged = node.addWidget(
      'combo',
      'control_after_generate',
      'randomize',
      () => undefined,
      { serialize: false, values: ['randomize', 'fixed'] }
    )

    expect(optionsBagFlagged.options.serialize).toBe(false)
    expect(optionsBagFlagged.serialize).toBeUndefined()

    const { serialised, proof } = proveRealSerialization(node)

    expect(serialised.widgets_values).toEqual([1, 'randomize'])
    expect(proof.provable).toBe(true)
    expect(proof.order).toEqual(['seed', 'control_after_generate'])
    expect(proof.refusal).toBeNull()
  })

  it('excludes a widget flagged on the widget itself, because widgets_values does too', () => {
    const node = nodeInGraph()
    node.addWidget('text', 'audio', 'clip.mp3', () => undefined, {})
    const widgetFlagged = node.addWidget(
      'button',
      'audioUI',
      '',
      () => undefined,
      {}
    )
    widgetFlagged.serialize = false

    const { serialised, proof } = proveRealSerialization(node)

    expect(serialised.widgets_values).toEqual(['clip.mp3'])
    expect(proof.provable).toBe(true)
    expect(proof.order).toEqual(['audio'])
  })

  it('refuses a node whose serialize_widgets flag is off', () => {
    const node = nodeInGraph()
    node.addWidget('number', 'mode', 1, () => undefined, {})
    node.serialize_widgets = false

    const { proof } = proveRealSerialization(node)

    expect(proof.provable).toBe(false)
    expect(proof.refusal).toBe('widgets_not_serialized')
  })
})
