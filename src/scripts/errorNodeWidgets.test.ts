import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

const onConfigureBeforeImport = LGraphNode.prototype.onConfigure
const { installErrorNodeWidgets } = await import('./errorNodeWidgets')
const onConfigureAtImport = LGraphNode.prototype.onConfigure

function configureMissingNode(
  widgets_values: ISerialisedNode['widgets_values']
) {
  const node = new LGraphNode('MissingNode')
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
    const node = configureMissingNode(['prompt', 7, true])
    expect(node.widgets?.map((widget) => [widget.name, widget.value])).toEqual([
      ['UNKNOWN', 'prompt'],
      ['UNKNOWN_1', 7],
      ['UNKNOWN_2', true]
    ])
    expect(node.serialize_widgets).toBe(true)
  })

  it('reads array-like widgets_values that custom nodes substitute for arrays', () => {
    installErrorNodeWidgets()

    const node = configureMissingNode(fromAny({ length: 2, 0: 'clip', 1: 3 }))
    expect(node.widgets?.map((widget) => widget.value)).toEqual(['clip', 3])
  })
})
