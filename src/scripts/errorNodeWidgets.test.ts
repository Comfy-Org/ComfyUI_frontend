import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import { useApp } from '@/scripts/appInstance'

const onConfigureBeforeImport = LGraphNode.prototype.onConfigure
const { installErrorNodeWidgets } = await import('./errorNodeWidgets')
const onConfigureAtImport = LGraphNode.prototype.onConfigure

function configureMissingNode(
  widgets_values: ISerialisedNode['widgets_values']
) {
  const graph = new LGraph()
  vi.spyOn(useApp(), 'rootGraph', 'get').mockReturnValue(graph)
  const node = new LGraphNode('MissingNode')
  graph.add(node)
  node.has_errors = true
  node.configure(
    fromPartial<ISerialisedNode>({ id: 1, type: 'MissingNode', widgets_values })
  )
  return node
}

describe('installErrorNodeWidgets', () => {
  it('leaves LGraphNode.prototype.onConfigure untouched at import', () => {
    expect(onConfigureAtImport).toBe(onConfigureBeforeImport)
  })

  it('adds placeholder widgets exactly once when installed twice', () => {
    installErrorNodeWidgets()
    const installed = LGraphNode.prototype.onConfigure
    installErrorNodeWidgets()

    expect(LGraphNode.prototype.onConfigure).toBe(installed)
    const node = configureMissingNode(['prompt', 7, true, { foo: 'bar' }])
    expect(node.widgets?.map((widget) => [widget.name, widget.value])).toEqual([
      ['UNKNOWN', 'prompt'],
      ['UNKNOWN_1', 7],
      ['UNKNOWN_2', true],
      ['UNKNOWN_3', '{"foo":"bar"}']
    ])
    expect(node.serialize_widgets).toBe(true)
  })

  it('reads array-like widgets_values that custom nodes substitute for arrays', () => {
    installErrorNodeWidgets()

    const node = configureMissingNode(fromAny({ length: 2, 0: 'clip', 1: 3 }))
    expect(node.widgets?.map((widget) => widget.value)).toEqual(['clip', 3])
  })
})

describe('configure widget restoration', () => {
  it('realigns late widget values when preceding saved controls are omitted', () => {
    const node = new LGraphNode('CustomNode')
    const seed = node.addWidget('number', 'seed', 0, () => {})
    seed.controlConfig = { mode: 'fixed', hasFilter: false }
    node.onConfigure = () => {
      node.addWidget('text', 'prompt', '', () => {})
    }

    node.configure(
      fromPartial<ISerialisedNode>({
        id: 1,
        type: 'CustomNode',
        widgets_values: [7, 'restored']
      })
    )

    expect(node.widgets?.map((widget) => widget.value)).toEqual([7, 'restored'])
  })

  it('keeps onConfigure assignments while restoring late widget controls', () => {
    const node = new LGraphNode('CustomNode')
    const steps = node.addWidget('number', 'steps', 1, () => {})
    node.onConfigure = () => {
      steps.value = 6
      const seed = node.addWidget('number', 'seed', 0, () => {})
      seed.controlConfig = { mode: 'fixed', hasFilter: false }
      seed.value = 99
    }

    node.configure(
      fromPartial<ISerialisedNode>({
        id: 1,
        type: 'CustomNode',
        widgets_values: [5, 7, 'increment']
      })
    )

    expect(node.widgets?.map((widget) => widget.value)).toEqual([6, 99])
    expect(node.widgets?.[1].controlConfig?.mode).toBe('increment')
  })
})
