import { describe, expect, it } from 'vitest'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'
import { toLinkId } from '@/types/linkId'

import { outputAsSerialisable } from './slotUtils'

type OutputSlotParam = INodeOutputSlot & { widget?: IWidget }

describe('outputAsSerialisable', () => {
  it('clones the links array to prevent shared reference mutation', () => {
    const node = new LGraphNode('test')
    const output = node.addOutput('out', 'number')
    output.links = [toLinkId(1), toLinkId(2), toLinkId(3)]

    const serialised = outputAsSerialisable(output as OutputSlotParam)

    expect(serialised.links).toEqual([1, 2, 3])
    expect(serialised.links).not.toBe(output.links)

    // Mutating the live array should NOT affect the serialised copy
    output.links.push(toLinkId(4))
    expect(serialised.links).toHaveLength(3)
  })

  it('preserves null links', () => {
    const node = new LGraphNode('test')
    const output = node.addOutput('out', 'number')
    output.links = null

    const serialised = outputAsSerialisable(output as OutputSlotParam)
    expect(serialised.links).toBeNull()
  })

  it('serialises only the widget name for outputs with widgets', () => {
    const node = new LGraphNode('test')
    const output = node.addOutput('out', 'number') as OutputSlotParam
    output.widget = node.addWidget(
      'number',
      'my-widget',
      0,
      null
    ) as INumericWidget

    const serialised = outputAsSerialisable(output)
    expect(serialised.widget).toEqual({ name: 'my-widget' })
  })
})
