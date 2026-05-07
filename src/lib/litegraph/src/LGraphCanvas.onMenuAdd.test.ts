import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

class TestNode extends LGraphNode {
  static override type = 'TestNode'

  constructor(title?: string) {
    super(title ?? 'TestNode')
  }
}

function makeNodeClass(title: string) {
  class N extends TestNode {
    static override title = title

    constructor() {
      super(title)
    }
  }
  return N
}

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    roundRect: vi.fn(),
    getTransform: vi
      .fn()
      .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline
  } satisfies Partial<CanvasRenderingContext2D>

  el.getContext = vi
    .fn()
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })

  return new LGraphCanvas(el, graph, { skip_render: true })
}

type MenuEntry = IContextMenuValue<string>

describe('LGraphCanvas.onMenuAdd category sorting', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  const registeredTypes: string[] = []
  let originalContextMenu: typeof LiteGraph.ContextMenu
  const capturedEntries: MenuEntry[][] = []

  beforeEach(() => {
    graph = new LGraph()
    canvas = createCanvas(graph)
    LGraphCanvas.active_canvas = canvas

    capturedEntries.length = 0
    originalContextMenu = LiteGraph.ContextMenu
    const MockContextMenu = vi.fn(function (
      this: unknown,
      values: MenuEntry[]
    ) {
      capturedEntries.push(values)
    }) as unknown as typeof LiteGraph.ContextMenu
    LiteGraph.ContextMenu = MockContextMenu
  })

  afterEach(() => {
    LiteGraph.ContextMenu = originalContextMenu
    for (const type of registeredTypes) {
      delete LiteGraph.registered_node_types[type]
    }
    registeredTypes.length = 0
  })

  function register(type: string, title: string) {
    LiteGraph.registerNodeType(type, makeNodeClass(title))
    registeredTypes.push(type)
  }

  function openTopLevelMenu() {
    const event = new MouseEvent('contextmenu', { clientX: 10, clientY: 10 })
    LGraphCanvas.onMenuAdd(undefined, undefined, event)
    return event
  }

  function drillInto(label: string, sourceEvent: MouseEvent) {
    const top = capturedEntries[capturedEntries.length - 1]
    const entry = top.find((e) => e.content === label)
    expect(entry, `submenu entry "${label}" should exist`).toBeDefined()
    expect(entry!.callback).toBeDefined()
    expect(typeof entry!.value).toBe('string')
    const callback = entry!.callback!
    callback({ value: entry!.value }, undefined, sourceEvent, undefined)
  }

  it('sorts top-level category submenus alphabetically (case-insensitive)', () => {
    register('zebra/zNode', 'Zebra Node')
    register('Apple/aNode', 'Apple Node')
    register('middle/mNode', 'Middle Node')

    openTopLevelMenu()

    const submenuLabels = capturedEntries[0]
      .filter((e) => e.has_submenu)
      .map((e) => e.content)
    const ours = submenuLabels.filter((label) =>
      ['Apple', 'middle', 'zebra'].includes(label ?? '')
    )
    expect(ours).toEqual(['Apple', 'middle', 'zebra'])
  })

  it('uses natural numeric ordering for numbered category names', () => {
    register('Cat10/n10', 'Item10')
    register('Cat2/n2', 'Item2')
    register('Cat1/n1', 'Item1')

    openTopLevelMenu()

    const ours = capturedEntries[0]
      .filter(
        (e) =>
          e.has_submenu && ['Cat1', 'Cat2', 'Cat10'].includes(e.content ?? '')
      )
      .map((e) => e.content)
    expect(ours).toEqual(['Cat1', 'Cat2', 'Cat10'])
  })

  it('sorts leaf nodes inside a category alphabetically', () => {
    register('leafsort/Zeta', 'Zeta')
    register('leafsort/Alpha', 'Alpha')
    register('leafsort/Mike', 'Mike')

    const event = openTopLevelMenu()
    drillInto('leafsort', event)

    const leafLabels = capturedEntries[1]
      .filter((e) => !e.has_submenu)
      .map((e) => e.content)
    expect(leafLabels).toEqual(['Alpha', 'Mike', 'Zeta'])
  })

  it('places category submenus before leaf entries within a category level', () => {
    register('mixed/leafA', 'A Leaf')
    register('mixed/leafZ', 'Z Leaf')
    register('mixed/inner/deep', 'Deep')

    const event = openTopLevelMenu()
    drillInto('mixed', event)

    const inside = capturedEntries[1]
    const ours = inside.filter((e) =>
      ['inner', 'A Leaf', 'Z Leaf'].includes(e.content ?? '')
    )
    expect(ours[0].content).toBe('inner')
    expect(ours[0].has_submenu).toBe(true)
    expect(ours[1].content).toBe('A Leaf')
    expect(ours[2].content).toBe('Z Leaf')
  })
})
