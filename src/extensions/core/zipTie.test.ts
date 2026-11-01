import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { setLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

import { installZipTieInteraction, zipTieExtension } from './zipTie'
import { createZipTie, getZipTies } from './zipTieRouting'

function setup() {
  const graph = new LGraph()
  const source = createTestNode(graph, [], ['MODEL', 'CONDITIONING'])
  const target = createTestNode(graph, ['MODEL', 'CONDITIONING'])
  const links = [0, 1].map((slot) => {
    const link = source.connect(slot, target, slot)
    assert.exists(link)
    return link
  })
  const canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
  canvas.ds.scale = 1
  canvas.ds.offset = [0, 0]
  vi.spyOn(canvas.canvas, 'setPointerCapture').mockImplementation(() => {})
  vi.spyOn(canvas.canvas, 'hasPointerCapture').mockReturnValue(false)
  document.body.append(canvas.canvas)
  const dispose = installZipTieInteraction(canvas)
  onTestFinished(() => {
    dispose()
    canvas.unbindEvents()
    canvas.canvas.remove()
  })
  return { canvas, graph, links }
}

function pointer(
  type: string,
  x: number,
  y: number,
  button = 0,
  modifiers: PointerEventInit = {}
) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    isPrimary: true,
    button,
    ...modifiers
  })
}

const metaShift = { metaKey: true, shiftKey: true }

function setupMarquee() {
  const fixture = setup()
  fixture.links.forEach((link, index) => {
    setLinkPolyline(link, () => [
      { x: 300, y: 150 + index * 20 },
      { x: 500, y: 150 + index * 20 }
    ])
    fixture.canvas.renderedPaths.add(link)
  })
  return fixture
}

describe('zip tie interaction', () => {
  it.for([
    { from: [320, 130], to: [480, 190] },
    { from: [480, 190], to: [320, 130] }
  ])(
    'zips crossed wires on Meta+Shift drag release from $from to $to',
    ({ from, to }) => {
      const { canvas, graph, links } = setupMarquee()
      const connections = links.map((link) => link.serialize())

      canvas.canvas.dispatchEvent(
        pointer('pointerdown', from[0], from[1], 0, metaShift)
      )
      canvas.canvas.dispatchEvent(
        pointer('pointermove', to[0], to[1], 0, metaShift)
      )

      expect(graph.reroutes.size).toBe(0)
      expect(canvas.dragging_rectangle).not.toBeNull()

      canvas.canvas.dispatchEvent(
        pointer('pointerup', to[0], to[1], 0, metaShift)
      )

      expect(getZipTies(graph)).toHaveLength(1)
      expect(
        [...graph.reroutes.values()].map((reroute) => [...reroute.pos])
      ).toEqual([
        [364, 157],
        [436, 157],
        [364, 163],
        [436, 163]
      ])
      expect(links.map((link) => link.serialize())).toEqual(connections)
      expect(canvas.selectedItems.size).toBe(0)
      expect(canvas.dragging_rectangle).toBeNull()
    }
  )

  it.for([
    {
      name: 'Escape',
      cancel: (canvas: HTMLCanvasElement) =>
        canvas.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        )
    },
    {
      name: 'pointer cancellation',
      cancel: (canvas: HTMLCanvasElement) =>
        canvas.dispatchEvent(pointer('pointercancel', 480, 190, 0, metaShift))
    },
    {
      name: 'lost capture',
      cancel: (canvas: HTMLCanvasElement) =>
        canvas.dispatchEvent(
          new PointerEvent('lostpointercapture', { pointerId: 1 })
        )
    }
  ])('does not zip a marquee interrupted by $name', ({ cancel }) => {
    const { canvas, graph } = setupMarquee()
    canvas.canvas.dispatchEvent(pointer('pointerdown', 320, 130, 0, metaShift))
    canvas.canvas.dispatchEvent(pointer('pointermove', 480, 190, 0, metaShift))

    cancel(canvas.canvas)
    canvas.canvas.dispatchEvent(pointer('pointerup', 480, 190, 0, metaShift))

    expect(getZipTies(graph)).toEqual([])
    expect(graph.reroutes.size).toBe(0)
    expect(canvas.dragging_rectangle).toBeNull()
  })

  it.for([
    { name: 'no modifiers', modifiers: {} },
    { name: 'Meta only', modifiers: { metaKey: true } },
    { name: 'Shift only', modifiers: { shiftKey: true } },
    { name: 'Control+Shift', modifiers: { ctrlKey: true, shiftKey: true } }
  ])('does not zip an ordinary drag with $name', ({ modifiers }) => {
    const { canvas, graph } = setupMarquee()
    canvas.canvas.dispatchEvent(pointer('pointerdown', 320, 130, 0, modifiers))
    canvas.canvas.dispatchEvent(pointer('pointermove', 480, 190, 0, modifiers))
    canvas.canvas.dispatchEvent(pointer('pointerup', 480, 190, 0, modifiers))

    expect(getZipTies(graph)).toEqual([])
    expect(graph.reroutes.size).toBe(0)
  })

  it('cancels the zip when Meta is released before the mouse', () => {
    const { canvas, graph } = setupMarquee()
    canvas.canvas.dispatchEvent(pointer('pointerdown', 320, 130, 0, metaShift))
    canvas.canvas.dispatchEvent(pointer('pointermove', 480, 190, 0, metaShift))
    canvas.canvas.dispatchEvent(
      pointer('pointerup', 480, 190, 0, { shiftKey: true })
    )

    expect(graph.reroutes.size).toBe(0)
    expect(canvas.dragging_rectangle).toBeNull()
  })

  it('does not create a tie when the box crosses only one wire', () => {
    const { canvas, graph } = setupMarquee()
    canvas.canvas.dispatchEvent(pointer('pointerdown', 320, 140, 0, metaShift))
    canvas.canvas.dispatchEvent(pointer('pointermove', 480, 160, 0, metaShift))
    canvas.canvas.dispatchEvent(pointer('pointerup', 480, 160, 0, metaShift))

    expect(graph.reroutes.size).toBe(0)
    expect(getZipTies(graph)).toEqual([])
  })

  it('bundles selected wires at the captured context menu position', async () => {
    const { canvas, graph, links } = setup()
    useLinkSelectionStore().select({
      links,
      marquee: { x: 10, y: 20, width: 30, height: 40 },
      anchorX: 40
    })
    canvas.graph_mouse[0] = 180
    canvas.graph_mouse[1] = 150
    const items = zipTieExtension.getCanvasMenuItems?.(canvas)
    const action = items?.[0]
    assert.exists(action)
    canvas.graph_mouse[0] = 800
    canvas.graph_mouse[1] = 800

    await action.callback?.call(document.createElement('div'))

    expect(getZipTies(graph)).toHaveLength(1)
    expect(
      [...graph.reroutes.values()].map((reroute) => [...reroute.pos])
    ).toEqual([
      [144, 147],
      [216, 147],
      [144, 153],
      [216, 153]
    ])
    expect(useLinkSelectionStore().selection).toBeNull()
  })

  it('moves the entire bundle while preserving each connection', () => {
    const { canvas, graph, links } = setup()
    createZipTie(graph, links, [180, 150])
    const connections = links.map((link) => link.serialize())

    canvas.canvas.dispatchEvent(pointer('pointerdown', 180, 150))
    document.dispatchEvent(pointer('pointermove', 223, 178))
    document.dispatchEvent(pointer('pointerup', 223, 178))

    expect(
      [...graph.reroutes.values()].map((reroute) => [...reroute.pos])
    ).toEqual([
      [187, 175],
      [259, 175],
      [187, 181],
      [259, 181]
    ])
    expect(links.map((link) => link.serialize())).toEqual(connections)
  })

  it.for([
    {
      name: 'Escape',
      cancel: () =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    },
    {
      name: 'pointer cancellation',
      cancel: () => document.dispatchEvent(pointer('pointercancel', 223, 178))
    },
    {
      name: 'lost pointer capture',
      cancel: (canvas: HTMLCanvasElement) =>
        canvas.dispatchEvent(
          new PointerEvent('lostpointercapture', { pointerId: 1 })
        )
    }
  ])('restores the bundle when a drag ends with $name', ({ cancel }) => {
    const { canvas, graph, links } = setup()
    createZipTie(graph, links, [180, 150])

    canvas.canvas.dispatchEvent(pointer('pointerdown', 180, 150))
    document.dispatchEvent(pointer('pointermove', 223, 178))
    cancel(canvas.canvas)

    expect(
      [...graph.reroutes.values()].map((reroute) => [...reroute.pos])
    ).toEqual([
      [144, 147],
      [216, 147],
      [144, 153],
      [216, 153]
    ])
  })

  it('releases a tie from its right-click menu without deleting links', async () => {
    const { canvas, graph, links } = setup()
    createZipTie(graph, links, [180, 150])

    canvas.canvas.dispatchEvent(pointer('pointerdown', 180, 150, 2))
    await userEvent
      .setup()
      .click(screen.getByRole('menuitem', { name: 'Release zip tie' }))

    expect(getZipTies(graph)).toEqual([])
    expect(graph.reroutes.size).toBe(0)
    expect(graph.links.size).toBe(2)
  })

  it.for(['read_only', 'selectOnly'] as const)(
    'keeps bundles fixed in %s mode',
    (mode) => {
      const { canvas, graph, links } = setup()
      createZipTie(graph, links, [180, 150])
      canvas[mode] = true

      canvas.canvas.dispatchEvent(pointer('pointerdown', 180, 150))
      document.dispatchEvent(pointer('pointermove', 223, 178))
      document.dispatchEvent(pointer('pointerup', 223, 178))

      expect(
        [...graph.reroutes.values()].map((reroute) => [...reroute.pos])
      ).toEqual([
        [144, 147],
        [216, 147],
        [144, 153],
        [216, 153]
      ])
    }
  )

  it('keeps the tie fixed when a click includes small pointer jitter', () => {
    const { canvas, graph, links } = setup()
    createZipTie(graph, links, [180, 150])

    canvas.canvas.dispatchEvent(pointer('pointerdown', 180, 150))
    document.dispatchEvent(pointer('pointermove', 183, 151))
    document.dispatchEvent(pointer('pointerup', 183, 151))

    expect(
      [...graph.reroutes.values()].map((reroute) => [...reroute.pos])
    ).toEqual([
      [144, 147],
      [216, 147],
      [144, 153],
      [216, 153]
    ])
  })
})
