import { describe, expect, it } from 'vitest'

import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'

function createNode(): LGraphNode {
  return { id: 1 } as unknown as LGraphNode
}

function createCanvas(): LGraphCanvas {
  return { graph: null } as unknown as LGraphCanvas
}

describe('vintageClipboard canary', () => {
  it('uses hand-rolled litegraph mocks', () => {
    const node = createNode()
    const canvas = createCanvas()

    expect(node.id).toBe(1)
    expect(canvas.graph).toBeNull()
  })
})
