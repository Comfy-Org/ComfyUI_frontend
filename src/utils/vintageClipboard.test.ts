import { describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'

function createNode(): LGraphNode {
  return { id: 1, title: 'Test' } as unknown as LGraphNode
}

function createCanvas(): LGraphCanvas {
  return {
    graph: {
      add: vi.fn()
    }
  } as unknown as LGraphCanvas
}

describe('vintage clipboard canary', () => {
  it('uses local litegraph builders', () => {
    expect(createNode().id).toBe(1)
    expect(createCanvas().graph).toBeDefined()
  })
})
