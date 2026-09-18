import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createPositionBounds } from '@/utils/positionBounds'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import {
  createAgentArrivalFramer,
  needsFraming,
  visibleGraphRect
} from './agentArrivalFraming'

vi.mock(import('@/platform/telemetry'))

/** The canvas surface this module reads and writes; nothing else is touched. */
function stubCanvas({
  width = 2560,
  height = 1440,
  scale = 1,
  offset = [0, 0] as [number, number]
} = {}) {
  const animateToBounds = vi.fn()
  const selectItems = vi.fn()
  const canvas = {
    canvas: { width, height },
    ds: { scale, offset },
    animateToBounds,
    selectItems
  } as unknown as LGraphCanvas
  return { canvas, animateToBounds, selectItems }
}

function node(pos: [number, number], size: [number, number] = [240, 86]) {
  return { pos, size } as unknown as LGraphNode
}

/** The docked panel, at its minimum width, covering the right of the canvas. */
function openPanel(width = 420) {
  const panel = useAgentPanelStore()
  panel.enabled = true
  panel.consentAccepted = true
  panel.isOpen = true
  panel.setWidth(width)
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('devicePixelRatio', 1)
})

describe('visibleGraphRect', () => {
  it('is the whole canvas in graph units while the panel is closed', () => {
    const { canvas } = stubCanvas()

    expect(visibleGraphRect(canvas)).toEqual([0, 0, 2560, 1440])
  })

  it('follows the camera', () => {
    const { canvas } = stubCanvas({ scale: 2, offset: [-500, -100] })

    expect(visibleGraphRect(canvas)).toEqual([500, 100, 1280, 720])
  })

  // The strip behind the docked panel is painted but not visible. Judging
  // arrival against `ds.visible_area`, which spans the whole element, would
  // call a node materialized under the panel "already on screen".
  it('excludes the strip behind the docked panel', () => {
    openPanel()
    const { canvas } = stubCanvas()

    expect(visibleGraphRect(canvas)).toEqual([0, 0, 2140, 1440])
  })

  it('is null when there is no visible area to decide against', () => {
    const { canvas } = stubCanvas({ width: 0, height: 0 })

    expect(visibleGraphRect(canvas)).toBeNull()
  })
})

describe('createPositionBounds', () => {
  it('pads the union of every node', () => {
    expect(
      createPositionBounds(
        [node([100, 100], [200, 50]), node([400, 300], [100, 100])],
        40
      )
    ).toEqual([60, 60, 480, 380])
  })

  it('is null with nothing to frame', () => {
    expect(createPositionBounds([], 40)).toBeNull()
  })
})

describe('needsFraming', () => {
  it('is false when one of the arrivals is on screen', () => {
    const { canvas } = stubCanvas()

    expect(needsFraming(canvas, [node([700, 200]), node([9000, 0])])).toBe(
      false
    )
  })

  it('is true when every arrival is off screen', () => {
    const { canvas } = stubCanvas()

    expect(needsFraming(canvas, [node([9000, 0])])).toBe(true)
  })

  it('is false with no arrivals', () => {
    const { canvas } = stubCanvas()

    expect(needsFraming(canvas, [])).toBe(false)
  })

  it('is false when there is no visible area to judge against', () => {
    const { canvas } = stubCanvas({ width: 0, height: 0 })

    expect(needsFraming(canvas, [node([9000, 0])])).toBe(false)
  })
})

describe('createAgentArrivalFramer', () => {
  const TURN = 'turn-1'

  function framer(turnId: () => string | null = () => TURN) {
    return createAgentArrivalFramer(turnId)
  }

  // The regression: the agent picks positions from the graph bounding box, so
  // on a wide graph its nodes land past the right edge of the camera.
  it('frames a build that landed off screen', () => {
    const { canvas, animateToBounds } = stubCanvas()

    framer().reveal(canvas, [node([3000, 0], [240, 86])])

    expect(animateToBounds).toHaveBeenCalledOnce()
    expect(animateToBounds.mock.calls[0][0]).toEqual([2960, -40, 320, 166])
    expect(animateToBounds.mock.calls[0][1]).toEqual({
      viewport: [0, 0, 2560, 1440]
    })
  })

  // An agent editing what the user is already looking at must not move the
  // camera under them.
  it('does not move the camera when the work landed in view', () => {
    const { canvas, animateToBounds } = stubCanvas()

    framer().reveal(canvas, [node([700, 200])])

    expect(animateToBounds).not.toHaveBeenCalled()
  })

  // One node in view is enough: the user is looking at the build.
  it('does not move the camera when only part of the arrival is in view', () => {
    const { canvas, animateToBounds } = stubCanvas()

    framer().reveal(canvas, [node([700, 200]), node([9000, 0])])

    expect(animateToBounds).not.toHaveBeenCalled()
  })

  // A node drawn behind the docked panel is not somewhere the user can see it.
  it('frames an arrival that landed behind the docked panel', () => {
    openPanel()
    const { canvas, animateToBounds } = stubCanvas()

    framer().reveal(canvas, [node([2200, 0])])

    expect(animateToBounds).toHaveBeenCalledOnce()
    expect(animateToBounds.mock.calls[0][1]).toEqual({
      viewport: [0, 0, 2140, 1440]
    })
  })

  it('frames nothing but the build', () => {
    const { canvas, animateToBounds } = stubCanvas({ offset: [-4000, 0] })

    framer().reveal(canvas, [node([9000, 0], [240, 86])])

    expect(animateToBounds.mock.calls[0][0]).toEqual([8960, -40, 320, 166])
  })

  // The bug one frame later: framing each frame on its own drops the turn's
  // earlier nodes the moment the agent places something further out.
  it('keeps a turn built over several frames together', () => {
    const { canvas, animateToBounds } = stubCanvas()
    const build = framer()

    build.reveal(canvas, [node([3000, 0], [240, 86])])
    build.reveal(canvas, [node([3400, 0], [240, 86])])

    expect(animateToBounds).toHaveBeenCalledTimes(2)
    expect(animateToBounds.mock.calls[1][0]).toEqual([2960, -40, 720, 166])
  })

  it('starts a new build when the turn changes', () => {
    const { canvas, animateToBounds } = stubCanvas()
    let turn = 'turn-1'
    const build = framer(() => turn)

    build.reveal(canvas, [node([3000, 0], [240, 86])])
    turn = 'turn-2'
    build.reveal(canvas, [node([3400, 0], [240, 86])])

    expect(animateToBounds.mock.calls[1][0]).toEqual([3360, -40, 320, 166])
  })

  // The id is cleared between turns, so a frame that lands after the turn was
  // marked done still belongs to the build it came from.
  it('does not split a build on a cleared turn id', () => {
    const { canvas, animateToBounds } = stubCanvas()
    let turn: string | null = 'turn-1'
    const build = framer(() => turn)

    build.reveal(canvas, [node([3000, 0], [240, 86])])
    turn = null
    build.reveal(canvas, [node([3400, 0], [240, 86])])

    expect(animateToBounds.mock.calls[1][0]).toEqual([2960, -40, 720, 166])
  })

  it('forgets the build on reset', () => {
    const { canvas, animateToBounds } = stubCanvas()
    const build = framer()

    build.reveal(canvas, [node([3000, 0], [240, 86])])
    build.reset()
    build.reveal(canvas, [node([3400, 0], [240, 86])])

    expect(animateToBounds.mock.calls[1][0]).toEqual([3360, -40, 320, 166])
  })

  it('selects the whole build so Fit View frames the new work', () => {
    const { canvas, selectItems } = stubCanvas()
    const first = node([700, 200])
    const second = node([900, 200])
    const build = framer()

    build.reveal(canvas, [first])
    build.reveal(canvas, [second])

    expect(selectItems).toHaveBeenLastCalledWith([first, second])
  })

  it('leaves the selection alone when asked, and still frames', () => {
    const { canvas, selectItems, animateToBounds } = stubCanvas()

    framer().reveal(canvas, [node([3000, 0])], { select: false })

    expect(selectItems).not.toHaveBeenCalled()
    expect(animateToBounds).toHaveBeenCalledOnce()
  })

  it('ignores a frame that materialized nothing', () => {
    const { canvas, selectItems, animateToBounds } = stubCanvas()

    framer().reveal(canvas, [])

    expect(selectItems).not.toHaveBeenCalled()
    expect(animateToBounds).not.toHaveBeenCalled()
  })

  it('makes no camera decision on an unsized canvas', () => {
    const { canvas, animateToBounds } = stubCanvas({ width: 0, height: 0 })

    framer().reveal(canvas, [node([3000, 0])])

    expect(animateToBounds).not.toHaveBeenCalled()
  })
})
