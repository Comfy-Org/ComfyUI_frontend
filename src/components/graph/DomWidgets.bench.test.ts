/**
 * Reactive-write regression tests for DomWidgets.updateWidgets.
 *
 * `updateWidgets` runs every canvas draw frame (60fps). Each reactive write to
 * widgetState fields (pos / size / zIndex / readonly / computedDisabled) fires
 * the downstream watchers in DomWidget.vue, which recompute style and call
 * setStyle on the DOM element. Before the equality-check optimization, idle
 * frames produced N writes per widget per frame across 5 fields = ~5N setStyle
 * calls per frame for free.
 *
 * These tests pin down:
 *   - Idle frames produce zero reactive writes per widget after init.
 *   - Pan frames force pos reassignment but skip the other 4 fields.
 *   - Selected-node movement forces pos reassignment on all visible widgets
 *     (so non-selected widgets refresh their clip-path).
 */
import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { watch } from 'vue'

import DomWidgets from '@/components/graph/DomWidgets.vue'
import { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

type TestWidget = BaseDOMWidget<object | string>

function createNode(graph: LGraph, id: number, pos: [number, number]) {
  const node = new LGraphNode(`n${id}`)
  node.id = id
  node.pos = [...pos]
  node.size = [240, 120]
  graph.add(node)
  return node
}

function createWidget(id: string, node: LGraphNode): TestWidget {
  return fromPartial<TestWidget>({
    id,
    node,
    name: 'w',
    type: 'custom',
    value: '',
    options: {},
    y: 12,
    width: 120,
    computedHeight: 40,
    margin: 10,
    isVisible: () => true
  })
}

function createCanvas(graph: LGraph): LGraphCanvas {
  return fromPartial<LGraphCanvas>({
    graph,
    low_quality: false,
    read_only: false,
    isNodeVisible: vi.fn(() => true),
    ds: { offset: [0, 0], scale: 1 },
    selected_nodes: {}
  })
}

function drawFrame(canvas: LGraphCanvas) {
  canvas.onDrawForeground?.({} as CanvasRenderingContext2D, new Rectangle())
}

interface WriteCounts {
  pos: number
  size: number
  zIndex: number
  readonly: number
  computedDisabled: number
}

function setupScene(nWidgets: number) {
  setActivePinia(createTestingPinia({ stubActions: false }))
  const canvasStore = useCanvasStore()
  const domWidgetStore = useDomWidgetStore()

  const graph = new LGraph()
  const widgetIds: string[] = []
  for (let i = 0; i < nWidgets; i++) {
    const node = createNode(graph, i, [i * 50, 0])
    const w = createWidget(`w${i}`, node)
    domWidgetStore.registerWidget(w)
    widgetIds.push(w.id)
  }

  const canvas = createCanvas(graph)
  canvasStore.canvas = canvas

  render(DomWidgets, { global: { stubs: { DomWidget: true } } })

  const counts: WriteCounts = {
    pos: 0,
    size: 0,
    zIndex: 0,
    readonly: 0,
    computedDisabled: 0
  }
  for (const id of widgetIds) {
    const s = domWidgetStore.widgetStates.get(id)!
    watch(
      () => s.pos,
      () => counts.pos++,
      { flush: 'sync' }
    )
    watch(
      () => s.size,
      () => counts.size++,
      { flush: 'sync' }
    )
    watch(
      () => s.zIndex,
      () => counts.zIndex++,
      { flush: 'sync' }
    )
    watch(
      () => s.readonly,
      () => counts.readonly++,
      { flush: 'sync' }
    )
    watch(
      () => s.computedDisabled,
      () => counts.computedDisabled++,
      { flush: 'sync' }
    )
  }

  return { canvas, counts, graph, domWidgetStore }
}

describe('DomWidgets reactive-write budget', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('writes nothing on idle frames after the initial frame', () => {
    const N = 20
    const { canvas, counts } = setupScene(N)

    drawFrame(canvas) // init frame seeds widgetState
    counts.pos = 0
    counts.size = 0
    counts.zIndex = 0
    counts.readonly = 0
    counts.computedDisabled = 0

    for (let i = 0; i < 60; i++) drawFrame(canvas)

    expect(counts.pos).toBe(0)
    expect(counts.size).toBe(0)
    expect(counts.zIndex).toBe(0)
    expect(counts.readonly).toBe(0)
    expect(counts.computedDisabled).toBe(0)
  })

  it('on viewport pan, forces pos writes only — size/zIndex/readonly stay quiet', () => {
    const N = 20
    const { canvas, counts } = setupScene(N)

    drawFrame(canvas)
    counts.pos = 0
    counts.size = 0
    counts.zIndex = 0
    counts.readonly = 0
    counts.computedDisabled = 0

    const FRAMES = 60
    for (let i = 1; i <= FRAMES; i++) {
      canvas.ds.offset[0] = i * 2
      drawFrame(canvas)
    }

    expect(counts.pos).toBe(N * FRAMES)
    expect(counts.size).toBe(0)
    expect(counts.zIndex).toBe(0)
    expect(counts.readonly).toBe(0)
    expect(counts.computedDisabled).toBe(0)
  })

  it('on selected-node drag, forces pos writes on all visible widgets — size/zIndex/readonly stay quiet', () => {
    const N = 20
    const { canvas, counts, graph } = setupScene(N)
    const draggedNode = graph.getNodeById(0)!
    canvas.selected_nodes = { [draggedNode.id]: draggedNode }

    drawFrame(canvas)
    counts.pos = 0
    counts.size = 0
    counts.zIndex = 0
    counts.readonly = 0
    counts.computedDisabled = 0

    const FRAMES = 60
    for (let i = 1; i <= FRAMES; i++) {
      draggedNode.pos[0] = i * 3
      drawFrame(canvas)
    }

    // Selected node moves → all N widgets re-evaluate pos so their clip-path
    // refreshes against the moved selection bounds.
    expect(counts.pos).toBe(N * FRAMES)
    expect(counts.size).toBe(0)
    expect(counts.zIndex).toBe(0)
    expect(counts.readonly).toBe(0)
    expect(counts.computedDisabled).toBe(0)
  })

  it('on non-selected single-node movement, only the moved widget re-writes pos', () => {
    const N = 20
    const { canvas, counts, graph } = setupScene(N)

    drawFrame(canvas)
    counts.pos = 0
    counts.size = 0
    counts.zIndex = 0
    counts.readonly = 0
    counts.computedDisabled = 0

    const movedNode = graph.getNodeById(5)!
    const FRAMES = 60
    for (let i = 1; i <= FRAMES; i++) {
      movedNode.pos[0] = 250 + i
      drawFrame(canvas)
    }

    expect(counts.pos).toBe(FRAMES) // 1 widget × FRAMES, not N × FRAMES
    expect(counts.size).toBe(0)
    expect(counts.zIndex).toBe(0)
    expect(counts.readonly).toBe(0)
    expect(counts.computedDisabled).toBe(0)
  })
})
