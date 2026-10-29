import { describe, expect, it, vi } from 'vitest'

import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { NewNodePosition } from '@/lib/litegraph/src/utils/arrange'

describe('LGraphCanvas deprecated aliases', () => {
  it('forwards repositionNodesVueMode to applyNodePositions', () => {
    const applyNodePositions = vi.fn()
    const canvas: LGraphCanvas = Object.assign(
      Object.create(LGraphCanvas.prototype),
      { applyNodePositions }
    )
    const positions: NewNodePosition[] = []

    canvas.repositionNodesVueMode(positions)

    expect(applyNodePositions).toHaveBeenCalledWith(positions)
  })
})
