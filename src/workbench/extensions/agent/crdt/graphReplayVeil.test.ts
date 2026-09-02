import { describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas, Rectangle } from '@/lib/litegraph/src/litegraph'
import type { Rect } from '@/lib/litegraph/src/interfaces'

import {
  drawNodeVeil,
  drawReplayVeil,
  installReplayVeil,
  REPLAY_VEIL_FILL
} from './graphReplayVeil'

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    fillStyle: ''
  } as unknown as CanvasRenderingContext2D
}

function makeNode(id: string, bounds: Rect) {
  return { id, getBounding: () => bounds }
}

function makeCanvas(
  nodes: Record<string, ReturnType<typeof makeNode>>,
  scale = 1
) {
  return {
    ds: { scale },
    graph: {
      getNodeById: (id: string) => nodes[id] ?? null
    },
    onDrawForeground: undefined
  } as unknown as LGraphCanvas
}

describe('drawNodeVeil', () => {
  it('paints a padded rounded rect at the node bounds, scaled by zoom', () => {
    const ctx = makeCtx()
    drawNodeVeil(ctx, [10, 20, 100, 50], 2)
    expect(ctx.fillStyle).toBe(REPLAY_VEIL_FILL)
    expect(ctx.roundRect).toHaveBeenCalledWith(8, 18, 104, 54, 4)
    expect(ctx.fill).toHaveBeenCalledOnce()
    expect(ctx.save).toHaveBeenCalledOnce()
    expect(ctx.restore).toHaveBeenCalledOnce()
  })
})

describe('drawReplayVeil', () => {
  it('is a no-op for an empty pending set', () => {
    const ctx = makeCtx()
    const canvas = makeCanvas({})
    drawReplayVeil(ctx, canvas, new Set())
    expect(ctx.fill).not.toHaveBeenCalled()
  })

  it('draws one veil per resolvable pending node id', () => {
    const ctx = makeCtx()
    const canvas = makeCanvas({
      n1: makeNode('n1', [0, 0, 10, 10]),
      n2: makeNode('n2', [5, 5, 20, 20])
    })
    drawReplayVeil(ctx, canvas, new Set(['n1', 'n2']))
    expect(ctx.roundRect).toHaveBeenCalledTimes(2)
  })

  it('skips pending ids that no longer resolve on the graph', () => {
    const ctx = makeCtx()
    const canvas = makeCanvas({ n1: makeNode('n1', [0, 0, 10, 10]) })
    drawReplayVeil(ctx, canvas, new Set(['n1', 'ghost']))
    expect(ctx.roundRect).toHaveBeenCalledTimes(1)
  })

  it('no-ops when the canvas has no graph', () => {
    const ctx = makeCtx()
    const canvas = { ds: { scale: 1 }, graph: null } as unknown as LGraphCanvas
    drawReplayVeil(ctx, canvas, new Set(['n1']))
    expect(ctx.roundRect).not.toHaveBeenCalled()
  })
})

describe('installReplayVeil', () => {
  it('chains after an existing onDrawForeground and draws pending veils', () => {
    const priorCalls: unknown[] = []
    const canvas = makeCanvas({ n1: makeNode('n1', [0, 0, 10, 10]) })
    canvas.onDrawForeground = function (ctx, visibleArea) {
      priorCalls.push([ctx, visibleArea])
    }
    let pending = new Set(['n1'])
    installReplayVeil(canvas, () => pending)

    const ctx = makeCtx()
    const visibleArea = [0, 0, 100, 100] as unknown as Rectangle
    canvas.onDrawForeground?.call(canvas, ctx, visibleArea)

    expect(priorCalls).toEqual([[ctx, visibleArea]])
    expect(ctx.roundRect).toHaveBeenCalledTimes(1)

    pending = new Set()
  })

  it('reads the pending set fresh on every draw', () => {
    const canvas = makeCanvas({ n1: makeNode('n1', [0, 0, 10, 10]) })
    let pending = new Set<string>()
    installReplayVeil(canvas, () => pending)
    const visibleArea = [0, 0, 1, 1] as unknown as Rectangle

    const ctx1 = makeCtx()
    canvas.onDrawForeground?.call(canvas, ctx1, visibleArea)
    expect(ctx1.roundRect).not.toHaveBeenCalled()

    pending = new Set(['n1'])
    const ctx2 = makeCtx()
    canvas.onDrawForeground?.call(canvas, ctx2, visibleArea)
    expect(ctx2.roundRect).toHaveBeenCalledTimes(1)
  })

  it('uninstall restores the previous handler', () => {
    const original = vi.fn()
    const canvas = makeCanvas({})
    canvas.onDrawForeground = original
    const handle = installReplayVeil(canvas, () => new Set())
    expect(canvas.onDrawForeground).not.toBe(original)
    handle.uninstall()
    expect(canvas.onDrawForeground).toBe(original)
  })
})
