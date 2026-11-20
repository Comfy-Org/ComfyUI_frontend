import { describe, expect, it } from 'vitest'

import { buildSnapIndex, snapMove, snapResize } from './snapSolver'
import type { VisualBox } from '@/lib/litegraph/src/utils/arrange'

import type { SnapOptions } from './snapSolver'

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  titleHeight = 0
): VisualBox => ({ x, y, width, height, titleHeight })

const edgesOnly: SnapOptions = {
  edges: true,
  wires: false,
  spacing: false,
  gap: 0
}
const threshold = { enter: 8, exit: 14 }

describe('snapMove', () => {
  it.for([
    { name: 'left to left', moving: box(105, 300, 50, 50), x: 100 },
    { name: 'right to right', moving: box(146, 300, 50, 50), x: 150 },
    { name: 'center to center', moving: box(128, 300, 40, 50), x: 130 }
  ])('aligns $name with a target', ({ moving, x }) => {
    const index = buildSnapIndex([box(100, 0, 100, 60)], edgesOnly)
    expect(snapMove(index, moving, { threshold }).box.x).toBe(x)
  })

  it('aligns body tops rather than title tops', () => {
    const index = buildSnapIndex([box(0, 100, 100, 100, 30)], edgesOnly)
    const { box: snapped } = snapMove(index, box(300, 115, 100, 100, 20), {
      threshold
    })
    expect(snapped.y + snapped.titleHeight).toBe(130)
  })

  it('abuts with the configured gap only when the boxes overlap across the axis', () => {
    const index = buildSnapIndex([box(0, 0, 100, 100)], {
      ...edgesOnly,
      gap: 20
    })
    expect(snapMove(index, box(124, 10, 50, 50), { threshold }).box.x).toBe(120)
    expect(snapMove(index, box(124, 500, 50, 50), { threshold }).box.x).toBe(
      124
    )
  })

  it('checks a cross-axis abut against the box after its other axis snapped', () => {
    const index = buildSnapIndex(
      [box(0, 0, 100, 100), box(101, 400, 100, 100)],
      {
        ...edgesOnly,
        gap: 10
      }
    )
    const { box: snapped, guides } = snapMove(index, box(95, 114, 100, 50), {
      threshold
    })
    expect(snapped).toMatchObject({ x: 101, y: 114 })
    expect(guides.filter((g) => g.kind === 'gap')).toEqual([])
  })

  it('drops an x abut that a later y snap moves out of overlap', () => {
    const index = buildSnapIndex(
      [box(0, 0, 120, 25)],
      { ...edgesOnly, wires: true, gap: 10 },
      {
        movingStart: box(300, 400, 50, 50),
        wires: [{ theirs: { x: 0, y: 30 }, mine: { x: 300, y: 400 } }]
      }
    )
    const {
      box: snapped,
      attachment,
      guides
    } = snapMove(index, box(128, 24, 50, 50), { threshold })
    expect(snapped).toMatchObject({ x: 128, y: 30 })
    expect(attachment.x).toBeUndefined()
    expect(guides.filter((g) => g.kind === 'gap')).toEqual([])
  })

  it('keeps offering spacing snaps when many unrelated targets are in view', () => {
    const scattered = Array.from({ length: 500 }, (_, i) =>
      box(5000 + (i % 25) * 300, 5000 + Math.floor(i / 25) * 300, 100, 100)
    )
    const index = buildSnapIndex(
      [box(0, 0, 100, 100), box(300, 0, 100, 100), ...scattered],
      { ...edgesOnly, edges: false, spacing: true }
    )
    expect(snapMove(index, box(146, 20, 100, 50), { threshold }).box.x).toBe(
      150
    )
  })

  it('stays attached until the exit threshold and releases beyond it', () => {
    const index = buildSnapIndex([box(100, 0, 100, 60)], edgesOnly)
    const first = snapMove(index, box(105, 300, 30, 30), { threshold })
    const held = snapMove(index, box(112, 300, 30, 30), {
      threshold,
      attachment: first.attachment
    })
    expect(held.box.x).toBe(100)
    const released = snapMove(index, box(115, 300, 30, 30), {
      threshold,
      attachment: held.attachment
    })
    expect(released.box.x).toBe(115)
  })

  it('leaves an attached edge for a higher-priority snap that comes into reach', () => {
    const index = buildSnapIndex(
      [box(0, 200, 100, 100)],
      { ...edgesOnly, wires: true },
      {
        movingStart: box(300, 0, 100, 100),
        wires: [{ theirs: { x: 100, y: 262 }, mine: { x: 300, y: 50 } }]
      }
    )
    const onEdge = snapMove(index, box(300, 203, 100, 100), { threshold })
    expect(onEdge.box.y).toBe(200)
    const onWire = snapMove(index, box(300, 205, 100, 100), {
      threshold,
      attachment: onEdge.attachment
    })
    expect(onWire.box.y).toBe(212)
  })

  it.for([
    {
      name: 'a wire beats a nearer edge',
      options: { ...edgesOnly, wires: true },
      moving: box(300, 202, 100, 100),
      y: 207
    },
    {
      name: 'spacing beats a nearer edge',
      options: { ...edgesOnly, spacing: true },
      moving: box(300, 202, 100, 100),
      y: 205
    },
    {
      name: 'a wire beats nearer spacing',
      options: { ...edgesOnly, edges: false, spacing: true, wires: true },
      moving: box(300, 204, 100, 100),
      y: 207
    }
  ])('$name', ({ options, moving, y }) => {
    const targets = [box(300, 0, 100, 50), box(300, 75, 100, 105)]
    const index = buildSnapIndex([...targets, box(0, 200, 100, 100)], options, {
      movingStart: box(300, 400, 100, 100),
      wires: [{ theirs: { x: 100, y: 257 }, mine: { x: 300, y: 450 } }]
    })
    expect(snapMove(index, moving, { threshold }).box.y).toBe(y)
  })

  it('centres a box in the gap between two neighbours', () => {
    const index = buildSnapIndex([box(0, 0, 100, 100), box(300, 0, 100, 100)], {
      ...edgesOnly,
      edges: false,
      spacing: true
    })
    expect(snapMove(index, box(146, 20, 100, 50), { threshold }).box.x).toBe(
      150
    )
  })

  it('repeats an existing gap after the last neighbour', () => {
    const index = buildSnapIndex([box(0, 0, 100, 100), box(140, 0, 100, 100)], {
      ...edgesOnly,
      edges: false,
      spacing: true
    })
    const { box: snapped, guides } = snapMove(index, box(283, 20, 60, 60), {
      threshold
    })
    expect(snapped.x).toBe(280)
    expect(guides.filter((g) => g.kind === 'gap')).toHaveLength(2)
  })

  it('draws no alignment lines when edge snapping is off', () => {
    const index = buildSnapIndex([box(100, 0, 100, 60)], {
      ...edgesOnly,
      edges: false
    })
    expect(
      snapMove(index, box(100, 300, 100, 60), { threshold }).guides
    ).toEqual([])
  })

  it('leaves the box alone when nothing is in reach', () => {
    const index = buildSnapIndex([box(0, 0, 100, 100)], edgesOnly)
    const moving = box(400, 400, 50, 50)
    expect(snapMove(index, moving, { threshold })).toEqual({
      box: moving,
      attachment: {},
      guides: []
    })
  })
})

describe('snapResize', () => {
  it('moves only the dragged edge and keeps the opposite edge fixed', () => {
    const index = buildSnapIndex([box(0, 0, 200, 100)], edgesOnly)
    const { box: snapped } = snapResize(
      index,
      box(50, 300, 145, 80),
      { x: 'right', y: 'bottom' },
      { threshold }
    )
    expect(snapped).toMatchObject({ x: 50, width: 150, y: 300, height: 80 })
  })

  it('snaps a dragged left edge without moving the right edge', () => {
    const index = buildSnapIndex([box(100, 0, 100, 100)], edgesOnly)
    const { box: snapped } = snapResize(
      index,
      box(96, 300, 304, 80),
      { x: 'left' },
      { threshold }
    )
    expect(snapped.x).toBe(100)
    expect(snapped.x + snapped.width).toBe(400)
  })

  it('ignores a snap that would shrink the box below its minimum size', () => {
    const index = buildSnapIndex([box(0, 0, 144, 100)], edgesOnly)
    const result = snapResize(
      index,
      box(50, 300, 100, 80),
      { x: 'right' },
      { threshold },
      { width: 100, height: 0 }
    )
    expect(result.box.width).toBe(100)
    expect(result.guides).toEqual([])
  })
})
