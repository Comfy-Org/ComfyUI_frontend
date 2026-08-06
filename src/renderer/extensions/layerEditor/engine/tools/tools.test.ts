import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Compositor } from '../compositor'
import type { Document } from '../document'
import { History } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import { registerBuiltinKinds } from '../kinds'
import { groupKind } from '../kinds/group'
import { rasterKind } from '../kinds/raster'
import type { GroupData, RasterData } from '../node'
import { defaultMode } from '../mode'
import type { Overlay, Tool, ToolContext } from '../tool'
import { getTool, registerTool, toolIds } from '../tool'
import { makeSelectToolDef } from './selectTool'
import { makeTransformToolDef } from './transformTool'

beforeAll(() => registerBuiltinKinds())

function root(children: RasterData[]): GroupData {
  return {
    kind: 'group',
    id: 'root',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children,
    passThrough: false
  }
}

const ev = { pressure: 0.5, shiftKey: false } as unknown as PointerEvent

interface Harness {
  ctx: ToolContext
  history: History
}

function harness(doc: Document, content: DefaultContentStore): Harness {
  const history = new History()
  const overlay: Overlay = {
    clear: vi.fn(),
    add: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    hitHandle: () => null
  }
  const state = { selected: [] as string[] }
  const ctx: ToolContext = {
    document: () => doc,
    history,
    compositor: {} as Compositor,
    content,
    overlay,
    activeNodeId: () =>
      state.selected.length ? state.selected[state.selected.length - 1] : null,
    setActiveNode: (id) => (state.selected = id ? [id] : []),
    selectedNodeIds: () => [...state.selected],
    setSelectedNodes: (ids) => (state.selected = [...ids]),
    selection: {
      combineShape: vi.fn(),
      currentMask: () => null,
      none: vi.fn()
    },
    compositePixels: () => null,
    floatSelection: () => false,
    zoom: () => 1,
    snapGrid: () => 0,
    requestRender: vi.fn()
  }
  return { ctx, history }
}

describe('SelectTool — pure select + move, no handles', () => {
  function setup() {
    const content = new DefaultContentStore()
    const raster = rasterKind.create({
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    })
    const doc: Document = {
      version: 2,
      width: 200,
      height: 200,
      root: root([raster]),
      channels: []
    }
    const h = harness(doc, content)
    h.ctx.setActiveNode(raster.id)
    return { h, raster, tool: makeSelectToolDef().create(h.ctx) }
  }

  it('moves the active node and records one command', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 50, y: 50 })
    tool.onMotion(ev, { x: 60, y: 55 })
    tool.onButtonRelease(ev, { x: 60, y: 55 })
    expect(raster.transform).toMatchObject({ x: 10, y: 5 })
    expect(h.history.canUndo()).toBe(true)
    h.history.undo()
    expect(raster.transform).toMatchObject({ x: 0, y: 0 })
  })

  it('never resizes: dragging on the box corner just moves', () => {
    const { raster, tool } = setup()
    tool.onButtonPress(ev, { x: 100, y: 100 })
    tool.onMotion(ev, { x: 200, y: 150 })
    tool.onButtonRelease(ev, { x: 200, y: 150 })
    expect(raster.transform).toMatchObject({ x: 100, y: 50, w: 100, h: 100 })
  })

  it('does not record a command when nothing moved', () => {
    const { h, tool } = setup()
    tool.onButtonPress(ev, { x: 50, y: 50 })
    tool.onButtonRelease(ev, { x: 50, y: 50 })
    expect(h.history.canUndo()).toBe(false)
  })

  it('moving a group translates all its children', () => {
    const content = new DefaultContentStore()
    const a = rasterKind.create({
      transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const b = rasterKind.create({
      transform: { x: 60, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const group = groupKind.create({ children: [a, b] })
    const doc: Document = {
      version: 2,
      width: 200,
      height: 200,
      root: root([group as unknown as RasterData]),
      channels: []
    }
    const h = harness(doc, content)
    h.ctx.setActiveNode(group.id)
    const tool = makeSelectToolDef().create(h.ctx)

    tool.onButtonPress(ev, { x: 25, y: 25 })
    tool.onMotion(ev, { x: 45, y: 35 })
    tool.onButtonRelease(ev, { x: 45, y: 35 })
    expect(a.transform).toMatchObject({ x: 20, y: 10 })
    expect(b.transform).toMatchObject({ x: 80, y: 10 })

    h.history.undo()
    expect(a.transform).toMatchObject({ x: 0, y: 0 })
    expect(b.transform).toMatchObject({ x: 60, y: 0 })
  })
})

describe('SelectTool — picking and modified clicks', () => {
  function pickSetup() {
    const content = new DefaultContentStore()
    const a = rasterKind.create({
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    })
    const b = rasterKind.create({
      transform: { x: 120, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const doc: Document = {
      version: 2,
      width: 200,
      height: 200,
      root: root([a, b]),
      channels: []
    }
    const h = harness(doc, content)
    return { h, a, b, tool: makeSelectToolDef().create(h.ctx) }
  }

  it('clicking an unselected layer picks it and starts the move', () => {
    const { h, b, tool } = pickSetup()
    tool.onButtonPress(ev, { x: 130, y: 20 })
    expect(h.ctx.activeNodeId()).toBe(b.id)
    tool.onMotion(ev, { x: 140, y: 30 })
    tool.onButtonRelease(ev, { x: 140, y: 30 })
    expect(b.transform).toMatchObject({ x: 130, y: 10 })
  })

  it('clicking empty space clears the selection', () => {
    const { h, a, tool } = pickSetup()
    h.ctx.setActiveNode(a.id)
    tool.onButtonPress(ev, { x: 190, y: 190 })
    expect(h.ctx.activeNodeId()).toBeNull()
  })

  it('shift-click toggles membership without moving anything', () => {
    const { h, a, b, tool } = pickSetup()
    const shiftEv = { pressure: 0.5, shiftKey: true } as unknown as PointerEvent
    h.ctx.setSelectedNodes([a.id])
    tool.onButtonPress(shiftEv, { x: 130, y: 20 })
    expect(h.ctx.selectedNodeIds()).toEqual([a.id, b.id])
    tool.onMotion(shiftEv, { x: 150, y: 40 })
    tool.onButtonRelease(shiftEv, { x: 150, y: 40 })
    expect(b.transform).toMatchObject({ x: 120, y: 0 })
    tool.onButtonPress(shiftEv, { x: 130, y: 20 })
    expect(h.ctx.selectedNodeIds()).toEqual([a.id])
    tool.onButtonPress(shiftEv, { x: 190, y: 190 })
    expect(h.ctx.selectedNodeIds()).toEqual([a.id])
  })

  it('a click inside the selection mask floats the selection instead of moving', () => {
    const { h, a, tool } = pickSetup()
    h.ctx.setActiveNode(a.id)
    const mask = {
      width: 200,
      height: 200,
      data: new Float32Array(200 * 200)
    }
    mask.data[20 * 200 + 20] = 1
    h.ctx.selection.currentMask = () => mask
    h.ctx.floatSelection = () => true
    tool.onButtonPress(ev, { x: 20, y: 20 })
    tool.onMotion(ev, { x: 40, y: 40 })
    tool.onButtonRelease(ev, { x: 40, y: 40 })
    expect(a.transform).toMatchObject({ x: 0, y: 0 })

    tool.onButtonPress(ev, { x: 60, y: 60 })
    tool.onMotion(ev, { x: 70, y: 60 })
    tool.onButtonRelease(ev, { x: 70, y: 60 })
    expect(a.transform).toMatchObject({ x: 10, y: 0 })
  })

  it('cursorFor reflects locks and hit opacity', () => {
    const { h, a, tool } = pickSetup()
    h.ctx.setActiveNode(a.id)
    expect(tool.cursorFor({ x: 50, y: 50 })).toBe('move')
    a.locks.position = true
    expect(tool.cursorFor({ x: 50, y: 50 })).toBe('not-allowed')
    expect(tool.cursorFor({ x: 190, y: 190 })).toBe('default')
  })
})

describe('tool registry', () => {
  it('registered tools are listed and retrievable; unknown ids throw', () => {
    registerTool({ id: 'probe-registry', create: () => ({}) as Tool })
    expect(toolIds()).toContain('probe-registry')
    expect(getTool('probe-registry').id).toBe('probe-registry')
    expect(() => getTool('nope')).toThrow('Unknown tool')
  })
})

describe('TransformTool — explicit session with apply/cancel', () => {
  function setup() {
    const content = new DefaultContentStore()
    const raster = rasterKind.create({
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    })
    const doc: Document = {
      version: 2,
      width: 200,
      height: 200,
      root: root([raster]),
      channels: []
    }
    const h = harness(doc, content)
    h.ctx.setActiveNode(raster.id)
    const tool = makeTransformToolDef().create(h.ctx)
    tool.onActivate?.()
    return { h, raster, tool }
  }

  it('resizes via handle, commits one undo step on apply', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 100, y: 100 })
    tool.onMotion(ev, { x: 200, y: 150 })
    tool.onButtonRelease(ev, { x: 200, y: 150 })
    expect(raster.transform).toMatchObject({ w: 200, h: 150 })
    expect(h.history.canUndo()).toBe(false)
    expect((tool as unknown as { isDirty(): boolean }).isDirty()).toBe(true)

    expect((tool as unknown as { apply(): boolean }).apply()).toBe(true)
    expect(h.history.canUndo()).toBe(true)
    h.history.undo()
    expect(raster.transform).toMatchObject({ w: 100, h: 100 })
  })

  it('shift-resize keeps the aspect ratio', () => {
    const { raster, tool } = setup()
    const evShift = { pressure: 0.5, shiftKey: true } as unknown as PointerEvent
    tool.onButtonPress(evShift, { x: 100, y: 100 })
    tool.onMotion(evShift, { x: 300, y: 120 })
    tool.onButtonRelease(evShift, { x: 300, y: 120 })
    expect(raster.transform.w / raster.transform.h).toBeCloseTo(1)
    expect(raster.transform.w).toBeCloseTo(210)
  })

  it('cancel restores the pre-session transform without touching history', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 100, y: 100 })
    tool.onMotion(ev, { x: 200, y: 150 })
    tool.onButtonRelease(ev, { x: 200, y: 150 })
    expect((tool as unknown as { cancel(): boolean }).cancel()).toBe(true)
    expect(raster.transform).toMatchObject({ x: 0, y: 0, w: 100, h: 100 })
    expect(h.history.canUndo()).toBe(false)
  })

  it('deactivating the tool auto-commits a dirty session', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 50, y: 50 })
    tool.onMotion(ev, { x: 70, y: 50 })
    tool.onButtonRelease(ev, { x: 70, y: 50 })
    tool.onDeactivate?.()
    expect(raster.transform).toMatchObject({ x: 20 })
    expect(h.history.canUndo()).toBe(true)
  })

  it('ignores groups', () => {
    const content = new DefaultContentStore()
    const a = rasterKind.create({
      transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const group = groupKind.create({ children: [a] })
    const doc: Document = {
      version: 2,
      width: 200,
      height: 200,
      root: root([group as unknown as RasterData]),
      channels: []
    }
    const h = harness(doc, content)
    h.ctx.setActiveNode(group.id)
    const tool = makeTransformToolDef().create(h.ctx)
    tool.onActivate?.()
    tool.onButtonPress(ev, { x: 25, y: 25 })
    tool.onMotion(ev, { x: 45, y: 25 })
    tool.onButtonRelease(ev, { x: 45, y: 25 })
    expect(a.transform).toMatchObject({ x: 0, y: 0 })
    expect(h.history.canUndo()).toBe(false)
  })
})

describe('TransformTool — unified gizmo over a multi-layer selection', () => {
  function setup() {
    const content = new DefaultContentStore()
    const a = rasterKind.create({
      transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const b = rasterKind.create({
      transform: { x: 100, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const doc: Document = {
      version: 2,
      width: 300,
      height: 300,
      root: root([a, b]),
      channels: []
    }
    const h = harness(doc, content)
    h.ctx.setSelectedNodes([a.id, b.id])
    const tool = makeTransformToolDef().create(h.ctx)
    tool.onActivate?.()
    return { h, a, b, tool }
  }

  it('moves every selected layer and records a single undo step', () => {
    const { h, a, b, tool } = setup()
    tool.onButtonPress(ev, { x: 75, y: 25 })
    tool.onMotion(ev, { x: 85, y: 35 })
    tool.onButtonRelease(ev, { x: 85, y: 35 })
    expect(a.transform).toMatchObject({ x: 10, y: 10 })
    expect(b.transform).toMatchObject({ x: 110, y: 10 })

    expect((tool as unknown as { apply(): boolean }).apply()).toBe(true)
    expect(h.history.canUndo()).toBe(true)
    h.history.undo()
    expect(a.transform).toMatchObject({ x: 0, y: 0 })
    expect(b.transform).toMatchObject({ x: 100, y: 0 })
    expect(h.history.canUndo()).toBe(false)
  })

  it('scales the axis-aligned group non-uniformly (edge drag = width only)', () => {
    const { a, b, tool } = setup()
    tool.onButtonPress(ev, { x: 150, y: 25 })
    tool.onMotion(ev, { x: 300, y: 25 })
    tool.onButtonRelease(ev, { x: 300, y: 25 })
    expect(a.transform).toMatchObject({ x: 0, y: 0, w: 100, h: 50 })
    expect(b.transform).toMatchObject({ x: 200, y: 0, w: 100, h: 50 })
  })

  it('Shift constrains the group scale to uniform', () => {
    const { a, b, tool } = setup()
    const evShift = { pressure: 0.5, shiftKey: true } as unknown as PointerEvent
    tool.onButtonPress(evShift, { x: 150, y: 25 })
    tool.onMotion(evShift, { x: 300, y: 25 })
    tool.onButtonRelease(evShift, { x: 300, y: 25 })
    expect(a.transform.h).toBeGreaterThan(50)
    expect(a.transform.w / a.transform.h).toBeCloseTo(1)
    expect(b.transform.w).toBeCloseTo(a.transform.w)
  })

  it('falls back to uniform when any selected layer is rotated', () => {
    const { a, b, tool } = setup()
    a.transform = { ...a.transform, rotation: 0.3 }
    tool.onActivate?.()
    tool.onButtonPress(ev, { x: 150, y: 25 })
    tool.onMotion(ev, { x: 300, y: 25 })
    tool.onButtonRelease(ev, { x: 300, y: 25 })
    expect(b.transform.h).toBeGreaterThan(50)
    expect(b.transform.w / b.transform.h).toBeCloseTo(1)
  })

  it('rotates every layer about the union centre by the same angle', () => {
    const { a, b, tool } = setup()
    const rot = { x: 75, y: 25 - 25 - 24 }
    tool.onButtonPress(ev, rot)
    tool.onMotion(ev, { x: 75 + 49, y: 25 })
    tool.onButtonRelease(ev, { x: 75 + 49, y: 25 })
    expect(a.transform.rotation).toBeCloseTo(Math.PI / 2)
    expect(b.transform.rotation).toBeCloseTo(Math.PI / 2)
    const ca = {
      x: a.transform.x + a.transform.w / 2,
      y: a.transform.y + a.transform.h / 2
    }
    const cb = {
      x: b.transform.x + b.transform.w / 2,
      y: b.transform.y + b.transform.h / 2
    }
    expect(Math.hypot(ca.x - cb.x, ca.y - cb.y)).toBeCloseTo(100)
  })

  it('undoes a group rotate in one step', () => {
    const { h, a, b, tool } = setup()
    const rot = { x: 75, y: -24 }
    tool.onButtonPress(ev, rot)
    tool.onMotion(ev, { x: 124, y: 25 })
    tool.onButtonRelease(ev, { x: 124, y: 25 })
    expect((tool as unknown as { apply(): boolean }).apply()).toBe(true)
    h.history.undo()
    expect(a.transform).toMatchObject({ x: 0, y: 0, rotation: 0 })
    expect(b.transform).toMatchObject({ x: 100, y: 0, rotation: 0 })
    expect(h.history.canUndo()).toBe(false)
  })
})

describe('TransformTool — guide snapping', () => {
  function setup(guides: Array<{ axis: 'x' | 'y'; pos: number }>) {
    const content = new DefaultContentStore()
    const raster = rasterKind.create({
      transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const doc: Document = {
      version: 2,
      width: 800,
      height: 600,
      root: root([raster]),
      channels: [],
      guides
    }
    const h = harness(doc, content)
    h.ctx.setActiveNode(raster.id)
    const tool = makeTransformToolDef().create(h.ctx)
    tool.onActivate?.()
    return { h, raster, tool }
  }

  it('snaps a moved layer edge onto a document guide', () => {
    const { raster, tool } = setup([{ axis: 'x', pos: 100 }])
    tool.onButtonPress(ev, { x: 25, y: 25 })
    tool.onMotion(ev, { x: 72, y: 25 })
    expect(raster.transform.x).toBeCloseTo(50, 6)
    tool.onButtonRelease(ev, { x: 72, y: 25 })
  })

  it('Alt bypasses guide snapping', () => {
    const { raster, tool } = setup([{ axis: 'x', pos: 100 }])
    const altEv = {
      pressure: 0.5,
      shiftKey: false,
      altKey: true
    } as unknown as PointerEvent
    tool.onButtonPress(altEv, { x: 25, y: 25 })
    tool.onMotion(altEv, { x: 72, y: 25 })
    expect(raster.transform.x).toBeCloseTo(47, 6)
    tool.onButtonRelease(altEv, { x: 72, y: 25 })
  })

  it('snaps to a horizontal guide on the y axis', () => {
    const { raster, tool } = setup([{ axis: 'y', pos: 200 }])
    tool.onButtonPress(ev, { x: 25, y: 25 })
    tool.onMotion(ev, { x: 25, y: 172 })
    expect(raster.transform.y).toBeCloseTo(150, 6)
    tool.onButtonRelease(ev, { x: 25, y: 172 })
  })
})
