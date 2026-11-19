import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphBadge, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'
import type { Comfy } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

function drawn(node: LGraphNode): LGraphBadge[] {
  return node.badges.map((badge) =>
    badge instanceof LGraphBadge ? badge : badge()
  )
}

describe('node badges', () => {
  let graph: LGraph
  let comfy: Comfy

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy } = createComfyApi({ getGraph: () => graph }))
  })

  function add() {
    const node = new LGraphNode('Node', 'TestNode')
    graph.add(node)
    const handle = comfy.graph.node(String(node.id))
    assert(handle)
    return { node, handle }
  }

  it('puts a badge with the pack’s text and colors on the node', () => {
    const { node, handle } = add()

    handle.addBadge({ text: '42', color: '#fff', bgColor: '#000' })

    expect(drawn(node)).toEqual([
      expect.objectContaining({ text: '42', fgColor: '#fff', bgColor: '#000' })
    ])
  })

  it('uses the default colors when the pack gives none', () => {
    const { node, handle } = add()
    const defaults = new LGraphBadge({ text: '' })

    handle.addBadge({ text: 'plain' })

    expect(drawn(node)[0]).toMatchObject({
      fgColor: defaults.fgColor,
      bgColor: defaults.bgColor,
      onClick: undefined
    })
  })

  it('reads an object badge once, so a later change to the object does not show', () => {
    const { node, handle } = add()
    const badge = { text: 'first' }

    handle.addBadge(badge)
    badge.text = 'second'

    expect(drawn(node)[0].text).toBe('first')
  })

  it('asks a badge function each time the badge is drawn', () => {
    const { node, handle } = add()
    let count = 0

    handle.addBadge(() => ({ text: String(++count) }))

    expect(drawn(node)[0].text).toBe('1')
    expect(drawn(node)[0].text).toBe('2')
  })

  it('removes only its own badge, and its disposer is safe to call twice', () => {
    const { node, handle } = add()
    const removeFirst = handle.addBadge({ text: 'first' })
    handle.addBadge({ text: 'second' })

    removeFirst()
    removeFirst()

    expect(drawn(node).map((badge) => badge.text)).toEqual(['second'])
  })

  it('redraws the node when a badge comes and goes', () => {
    const { node, handle } = add()
    const redraw = vi.spyOn(node, 'setDirtyCanvas')

    const remove = handle.addBadge({ text: 'x' })
    remove()

    expect(redraw).toHaveBeenCalledTimes(2)
  })

  it('calls the pack when its badge is clicked, and reports a click handler that throws', () => {
    const { node, handle } = add()
    const failure = new Error('click failed')
    const onClick = vi.fn(() => {
      throw failure
    })
    handle.addBadge({ text: 'go', onClick })

    drawn(node)[0].onClick?.(new MouseEvent('click'))

    expect(onClick).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'node_api_listener_failure',
      surface: 'platform',
      tags: { event: 'addBadge' }
    })
  })

  it('hides a badge whose function throws, and reports it once', () => {
    const { node, handle } = add()
    const define = vi.fn(() => {
      throw new Error('draw failed')
    })
    handle.addBadge(define)

    expect(drawn(node)[0].visible).toBe(false)
    expect(drawn(node)[0].visible).toBe(false)
    expect(define).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('hides a badge whose function gives something that is not a badge, and reports it once', () => {
    const { node, handle } = add()
    const define = vi.fn(() => ({ label: 'wrong' }))
    handle.addBadge(Object(define))

    expect(drawn(node)[0].visible).toBe(false)
    expect(drawn(node)[0].visible).toBe(false)
    expect(define).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(TypeError),
      expect.objectContaining({ tags: { event: 'addBadge' } })
    )
  })

  it.for([
    ['nothing', undefined],
    ['text that is a number', { text: 5 }],
    ['a color that is not text', { text: 'x', color: 1 }],
    ['a background that is not text', { text: 'x', bgColor: {} }],
    ['a click handler that is not a function', { text: 'x', onClick: 'go' }],
    ['a field badges do not have', { text: 'x', icon: 'star' }]
  ])('refuses %s before touching the node', ([, badge]) => {
    const { node, handle } = add()

    expectRefusal(
      () => Reflect.apply(handle.addBadge, undefined, [badge]),
      'addBadge'
    )
    expect(node.badges).toEqual([])
  })

  it('adds nothing to a removed node, and gives a disposer that does nothing', () => {
    const { node, handle } = add()
    graph.remove(node)

    const remove = handle.addBadge({ text: 'late' })

    expect(node.badges).toEqual([])
    expect(remove).not.toThrow()
  })

  it('makes no undo step', () => {
    const steps: string[] = []
    const tracked = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push('after')
      })
    }).comfy
    const node = new LGraphNode('Node', 'TestNode')
    graph.add(node)

    tracked.graph.node(String(node.id))?.addBadge({ text: 'x' })

    expect(node.badges).toHaveLength(1)
    expect(steps).toEqual([])
  })

  describe('on the canvas', () => {
    function badgeHitAt(node: LGraphNode, x: number, y: number) {
      return node.badges
        .map((badge) => (badge instanceof LGraphBadge ? badge : badge()))
        .find(
          ({ onClick, boundingRect: [left, top, width, height] }) =>
            onClick &&
            x >= left &&
            x < left + width &&
            y >= top &&
            y < top + height
        )
    }

    function drawnCentre(node: LGraphNode) {
      node.drawBadges(createMockCanvasRenderingContext2D())
      const [badge] = drawn(node)
      const [x, y, width, height] = badge.boundingRect
      expect(width).toBeGreaterThan(0)
      return [x + width / 2, y + height / 2] as const
    }

    it.for(['object', 'function'] as const)(
      'clicks a %s badge where it was drawn',
      (form) => {
        const { node, handle } = add()
        const onClick = vi.fn()
        const badge = { text: 'Go', onClick }
        handle.addBadge(form === 'object' ? badge : () => badge)

        const [x, y] = drawnCentre(node)
        badgeHitAt(node, x, y)?.onClick?.(new MouseEvent('click'))

        expect(onClick).toHaveBeenCalledOnce()
      }
    )

    it('hides a function badge that was shown once its function fails', () => {
      const { node, handle } = add()
      let fails = false
      handle.addBadge(() => {
        if (fails) throw new Error('later failure')
        return { text: 'Shown' }
      })
      expect(drawn(node)[0].visible).toBe(true)

      fails = true

      expect(drawn(node)[0].visible).toBe(false)
    })

    it('draws a function badge as one badge whose text and colors follow the function', () => {
      const { node, handle } = add()
      let state: { text: string; color?: string } = {
        text: 'One',
        color: '#f00'
      }
      handle.addBadge(() => state)
      const first = drawn(node)[0]

      state = { text: 'Two' }
      const second = drawn(node)[0]

      expect(second).toBe(first)
      expect(second).toMatchObject({
        text: 'Two',
        fgColor: new LGraphBadge({ text: '' }).fgColor
      })
    })
  })
})
