import { describe, expect, it } from 'vitest'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { outputAsSerialisable } from './slotUtils'

type OutputSlotParam = INodeOutputSlot & { widget?: IWidget }

describe('outputAsSerialisable', () => {
  it('clones the links array to prevent shared reference mutation', () => {
    const node = new LGraphNode('test')
    const output = node.addOutput('out', 'number')
    output.links = [1, 2, 3]

    const serialised = outputAsSerialisable(output as OutputSlotParam)

    expect(serialised.links).toEqual([1, 2, 3])
    expect(serialised.links).not.toBe(output.links)

    // Mutating the live array should NOT affect the serialised copy
    output.links.push(4)
    expect(serialised.links).toHaveLength(3)
  })

  it('preserves null links', () => {
    const node = new LGraphNode('test')
    const output = node.addOutput('out', 'number')
    output.links = null

    const serialised = outputAsSerialisable(output as OutputSlotParam)
    expect(serialised.links).toBeNull()
  })
})
