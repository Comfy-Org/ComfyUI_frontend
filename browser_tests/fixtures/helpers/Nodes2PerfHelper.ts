import type { CDPSession } from '@playwright/test'
import { expect } from '@playwright/test'

import { networkIsolationFixture as test } from '@e2e/fixtures/networkIsolationFixture'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { createLargePng } from '@e2e/fixtures/data/largePng'
import { NODES2_ACCEPTANCE_SETTINGS } from '@e2e/fixtures/data/nodes2AcceptanceSettings'
import { realisticPipelineGraph } from '@e2e/fixtures/data/realisticPipelineGraph'

interface FrameProbe {
  costs: number[]
  intervals: number[]
  keyLatencies: number[]
  recording: boolean
  flushKeys: () => void
}

interface ViewBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface ScreenPoint {
  x: number
  y: number
}

declare global {
  interface Window {
    __nodes2Perf?: FrameProbe
  }
}

export type RendererName = 'classic' | 'Nodes 2.0'

export interface PerfRenderer {
  name: RendererName
  vueNodes: boolean
}

export const PERF_RENDERERS: readonly PerfRenderer[] = [
  { name: 'classic', vueNodes: false },
  { name: 'Nodes 2.0', vueNodes: true }
]

export const PERF_VIEWPORT = { width: 1920, height: 1080 }
export const WORKING_ZOOM = 0.75
const LOW_QUALITY_ZOOM = 8 / 14

const PREVIEW_IMAGE = 'nodes2-acceptance-perf.png'
const QUIET_FRAMES = 30
const SLOW_FRAME_MS = 50
const SETTLE_CAP_MS = 180_000
const MIN_ACTIVE_FRAME_MS = 2

export interface LoadSample {
  timeToInteractiveMs: number
  heapMB: number
  vueNodeElements: number
}

export interface GestureSample {
  steps: number
  frames: number[]
  intervals: number[]
}

export interface FrameStats {
  frames: number
  median: number
  p95: number
  max: number
  medianFps: number
  mainThreadMedian: number
  mainThreadP95: number
}

const REFRESH_MS = 1000 / 60

function nearestRank(sorted: readonly number[], percentile: number) {
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))]
}

export function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function heaviest(values: readonly number[], count: number) {
  return [...values]
    .sort((a, b) => b - a)
    .slice(0, count)
    .sort((a, b) => a - b)
}

/**
 * Frame times (intervals between rendered frames) over the slowest frame per
 * input step, plus main-thread cost per frame for diagnosis.
 */
export function gestureFrameStats(sample: GestureSample): FrameStats {
  const frameTimes = heaviest(sample.intervals, sample.steps)
  const costs = heaviest(
    sample.frames.filter((cost) => cost >= MIN_ACTIVE_FRAME_MS),
    sample.steps
  )
  if (frameTimes.length === 0 || costs.length === 0)
    throw new Error('the gesture produced no measurable frames')
  return {
    frames: frameTimes.length,
    median: round(median(frameTimes)),
    p95: round(nearestRank(frameTimes, 95)),
    max: round(frameTimes[frameTimes.length - 1]),
    medianFps: round(1000 / median(frameTimes)),
    mainThreadMedian: round(median(costs)),
    mainThreadP95: round(nearestRank(costs, 95))
  }
}

/** Whole display refreshes a frame time spans, absorbing timer jitter. */
export function refreshes(frameTimeMs: number) {
  return Math.round(frameTimeMs / REFRESH_MS)
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits))
}

function spread(values: readonly number[]) {
  return {
    median: round(median(values), 2),
    min: round(Math.min(...values), 2),
    max: round(Math.max(...values), 2),
    values: values.map((value) => round(value, 2))
  }
}

/** Median of Nodes 2.0 over median of classic, with both spreads. */
export function compareRenderers<T>(
  samples: Record<RendererName, T[]>,
  value: (sample: T) => number
) {
  const classic = samples.classic.map(value)
  const nodes2 = samples['Nodes 2.0'].map(value)
  return {
    classic: spread(classic),
    nodes2: spread(nodes2),
    ratio: round(median(nodes2) / median(classic), 3)
  }
}

/** Reports measured values as a test annotation so runs can be compared. */
export function annotatePerf(data: object) {
  test.info().annotations.push({
    type: 'perf',
    description: JSON.stringify(data)
  })
}

export class Nodes2PerfHelper {
  private cdp: CDPSession | null = null

  constructor(private readonly comfyPage: ComfyPage) {}

  private get page() {
    return this.comfyPage.page
  }

  private async session() {
    if (!this.cdp) {
      this.cdp = await this.page.context().newCDPSession(this.page)
    }
    await this.cdp.send('Performance.enable')
    return this.cdp
  }

  async uploadPreviewImage() {
    const response = await this.page.request.post(
      `${this.comfyPage.url}/api/upload/image`,
      {
        multipart: {
          image: {
            name: PREVIEW_IMAGE,
            mimeType: 'image/png',
            buffer: createLargePng(1024, 1024, 7)
          },
          overwrite: 'true',
          type: 'input'
        }
      }
    )
    expect(response.ok(), 'preview image upload').toBe(true)
  }

  /**
   * Runs `measure` on a fresh page per renderer, alternating which renderer
   * goes first each repetition so drift affects both equally.
   */
  async interleave<T>(
    repetitions: number,
    measure: (renderer: PerfRenderer) => Promise<T>
  ): Promise<Record<RendererName, T[]>> {
    const samples: Record<RendererName, T[]> = {
      classic: [],
      'Nodes 2.0': []
    }
    for (let repetition = 0; repetition < repetitions; repetition++) {
      const order =
        repetition % 2 === 0 ? PERF_RENDERERS : [...PERF_RENDERERS].reverse()
      for (const renderer of order) {
        await this.openRenderer(renderer)
        samples[renderer.name].push(await measure(renderer))
      }
    }
    return samples
  }

  async openRenderer(renderer: PerfRenderer) {
    await this.page.goto('about:blank')
    await this.heapAfterGcMB()
    await this.comfyPage.setupSettings({
      userId: this.comfyPage.id,
      settings: {
        ...NODES2_ACCEPTANCE_SETTINGS,
        'Comfy.VueNodes.Enabled': renderer.vueNodes
      }
    })
    await this.comfyPage.setup()
    await this.prepare(renderer)
  }

  /** Verifies the open page runs `renderer` and installs the frame probe. */
  async prepare(renderer: PerfRenderer) {
    expect(
      await this.comfyPage.settings.getSetting('Comfy.VueNodes.Enabled'),
      `the page must run ${renderer.name}`
    ).toBe(renderer.vueNodes)
    await this.installProbe()
  }

  private async installProbe() {
    await this.page.evaluate(() => {
      if (window.__nodes2Perf) return
      const probe: FrameProbe = {
        costs: [],
        intervals: [],
        keyLatencies: [],
        recording: false,
        flushKeys: () => {}
      }
      window.__nodes2Perf = probe
      const nativeRequestFrame = window.requestAnimationFrame.bind(window)
      const frameEnd = new MessageChannel()
      let frameTimestamp = -1
      let frameStart = 0
      let inputStart = 0
      frameEnd.port1.onmessage = () => {
        if (frameStart && probe.recording)
          probe.costs.push(performance.now() - frameStart)
        frameStart = 0
        inputStart = 0
      }
      window.requestAnimationFrame = (callback) =>
        nativeRequestFrame((timestamp) => {
          if (timestamp !== frameTimestamp) {
            if (probe.recording && frameTimestamp > 0)
              probe.intervals.push(timestamp - frameTimestamp)
            frameTimestamp = timestamp
            const now = performance.now()
            frameStart = inputStart && now - inputStart < 100 ? inputStart : now
            frameEnd.port2.postMessage(null)
          }
          callback(timestamp)
        })
      const markInput = () => {
        if (!inputStart) inputStart = performance.now()
      }
      for (const type of ['pointermove', 'pointerdown', 'wheel', 'keydown'])
        window.addEventListener(type, markInput, {
          capture: true,
          passive: true
        })
      const recordKeys = (entries: PerformanceEntryList) => {
        for (const entry of entries)
          if (entry.name === 'keydown' && probe.recording)
            probe.keyLatencies.push(entry.duration)
      }
      const keyObserver = new PerformanceObserver((list) =>
        recordKeys(list.getEntries())
      )
      const eventTimingOptions = { type: 'event', durationThreshold: 16 }
      keyObserver.observe(eventTimingOptions)
      probe.flushKeys = () => recordKeys(keyObserver.takeRecords())
    })
  }

  private async metrics() {
    const cdp = await this.session()
    const { metrics } = await cdp.send('Performance.getMetrics')
    const read = (name: string) =>
      metrics.find((metric) => metric.name === name)?.value ?? 0
    return {
      taskSeconds: read('TaskDuration'),
      timestampSeconds: read('Timestamp'),
      heapBytes: read('JSHeapUsedSize')
    }
  }

  /** JS heap after forced garbage collection, in MB. */
  async heapAfterGcMB() {
    const cdp = await this.session()
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('HeapProfiler.collectGarbage')
    return round((await this.metrics()).heapBytes / 1048576, 1)
  }

  /** Resolves once frames are steady and mounted nodes stop changing; returns ms until the last disturbance. */
  async settle() {
    return this.page.evaluate(
      ({ quietFrames, slowFrameMs, capMs }) =>
        new Promise<number>((resolve, reject) => {
          const start = performance.now()
          let previous = start
          let lastDisturbance = start
          let quiet = 0
          let mounted = -1
          const tick = () => {
            const now = performance.now()
            const count = document.querySelectorAll('[data-node-id]').length
            if (now - previous > slowFrameMs || count !== mounted) {
              lastDisturbance = now
              quiet = 0
            } else {
              quiet++
            }
            previous = now
            mounted = count
            if (quiet >= quietFrames) resolve(lastDisturbance - start)
            else if (now - start > capMs)
              reject(new Error(`the page did not settle within ${capMs} ms`))
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }),
      {
        quietFrames: QUIET_FRAMES,
        slowFrameMs: SLOW_FRAME_MS,
        capMs: SETTLE_CAP_MS
      }
    )
  }

  async loadGraph(
    renderer: PerfRenderer,
    nodeCount: number
  ): Promise<LoadSample> {
    const workflow = realisticPipelineGraph(nodeCount, PREVIEW_IMAGE)
    const callMs = await this.page.evaluate(async (graph) => {
      const start = performance.now()
      await window.app!.loadGraphData(graph)
      return performance.now() - start
    }, workflow)
    const settledMs = await this.settle()
    const state = await this.page.evaluate(() => ({
      graphNodes: window.app!.graph.nodes.length,
      vueNodeElements: document.querySelectorAll('[data-node-id]').length
    }))
    expect(state.graphNodes, 'every generated node must load').toBe(nodeCount)
    if (renderer.vueNodes)
      expect(
        state.vueNodeElements,
        'Nodes 2.0 must render node elements'
      ).toBeGreaterThan(0)
    else
      expect(state.vueNodeElements, 'classic must not mount Vue nodes').toBe(0)
    return {
      timeToInteractiveMs: round(callMs + settledMs, 0),
      heapMB: await this.heapAfterGcMB(),
      vueNodeElements: state.vueNodeElements
    }
  }

  async graphBounds(): Promise<ViewBox> {
    return this.page.evaluate(() => {
      const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      }
      for (const node of window.app!.graph.nodes) {
        bounds.minX = Math.min(bounds.minX, node.pos[0])
        bounds.minY = Math.min(bounds.minY, node.pos[1])
        bounds.maxX = Math.max(bounds.maxX, node.pos[0] + node.size[0])
        bounds.maxY = Math.max(bounds.maxY, node.pos[1] + node.size[1])
      }
      return bounds
    })
  }

  /** Centres the view on a graph point (graph centre by default). */
  async showAt(scale: number, center?: ScreenPoint) {
    const bounds = await this.graphBounds()
    await this.page.evaluate(
      ({ scale, center }) => {
        const canvas = window.app!.canvas
        const width = canvas.canvas.clientWidth
        const height = canvas.canvas.clientHeight
        canvas.ds.scale = scale
        canvas.ds.offset[0] = width / 2 / scale - center.x
        canvas.ds.offset[1] = height / 2 / scale - center.y
        canvas.setDirty(true, true)
      },
      {
        scale,
        center: center ?? {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2
        }
      }
    )
    await this.settle()
  }

  /** Zooms out until the whole graph fits the canvas; returns the scale. */
  async showWholeGraph() {
    const bounds = await this.graphBounds()
    const scale = await this.page.evaluate((bounds) => {
      const canvas = window.app!.canvas
      return Math.min(
        canvas.canvas.clientWidth / (bounds.maxX - bounds.minX + 200),
        canvas.canvas.clientHeight / (bounds.maxY - bounds.minY + 200)
      )
    }, bounds)
    await this.showAt(scale)
    return scale
  }

  async viewState() {
    return this.page.evaluate(() => {
      const { ds } = window.app!.canvas
      return { x: ds.offset[0], y: ds.offset[1], scale: ds.scale }
    })
  }

  async canvasBox() {
    const box = await this.comfyPage.canvas.boundingBox()
    if (!box) throw new Error('the graph canvas has no bounding box')
    return box
  }

  /** The node of the given type nearest the graph centre. */
  async centralNode(type: string) {
    const bounds = await this.graphBounds()
    return this.page.evaluate(
      ({ type, cx, cy }) => {
        const nodes = window.app!.graph.nodes.filter((n) => n.type === type)
        const distance = (n: (typeof nodes)[number]) =>
          Math.hypot(n.pos[0] - cx, n.pos[1] - cy)
        const node = nodes.sort((a, b) => distance(a) - distance(b)).at(0)
        if (!node) throw new Error(`no ${type} node in the graph`)
        return {
          id: String(node.id),
          x: node.pos[0],
          y: node.pos[1],
          width: node.size[0],
          height: node.size[1]
        }
      },
      {
        type,
        cx: (bounds.minX + bounds.maxX) / 2,
        cy: (bounds.minY + bounds.maxY) / 2
      }
    )
  }

  /** Screen point on a node's title bar, from the rendered element when Nodes 2.0 is on. */
  async titlePoint(nodeId: string): Promise<ScreenPoint> {
    return this.page.evaluate((nodeId) => {
      const header = document.querySelector(
        `[data-node-id="${nodeId}"] [data-testid^="node-header-"]`
      )
      if (header) {
        const rect = header.getBoundingClientRect()
        return {
          x:
            rect.left +
            Math.min(rect.width / 3, 40 * window.app!.canvas.ds.scale),
          y: rect.top + rect.height / 2
        }
      }
      const canvas = window.app!.canvas
      const node = window.app!.graph.nodes.find(
        (candidate) => String(candidate.id) === nodeId
      )
      if (!node) throw new Error(`node ${nodeId} is missing`)
      const rect = canvas.canvas.getBoundingClientRect()
      const [x, y] = canvas.ds.convertOffsetToCanvas([
        node.pos[0] + Math.min(node.size[0] / 3, 40),
        node.pos[1] - window.LiteGraph!.NODE_TITLE_HEIGHT / 2
      ])
      return { x: rect.left + x, y: rect.top + y }
    }, nodeId)
  }

  async startFrames() {
    await this.page.evaluate(() => {
      const probe = window.__nodes2Perf!
      probe.costs = []
      probe.intervals = []
      probe.keyLatencies = []
      probe.recording = true
      const everyFrame = () => {
        if (probe.recording) window.requestAnimationFrame(everyFrame)
      }
      window.requestAnimationFrame(everyFrame)
    })
  }

  /** Keeps recording for `tailFrames` more frames, then returns the frame costs. */
  async stopFrames(tailFrames: number) {
    return this.page.evaluate(
      (tailFrames) =>
        new Promise<Omit<FrameProbe, 'recording' | 'flushKeys'>>((resolve) => {
          let remaining = tailFrames
          const tick = () => {
            if (remaining-- > 0) {
              requestAnimationFrame(tick)
              return
            }
            const probe = window.__nodes2Perf!
            probe.flushKeys()
            probe.recording = false
            resolve({
              costs: probe.costs.slice(),
              intervals: probe.intervals.slice(),
              keyLatencies: probe.keyLatencies.slice()
            })
          }
          requestAnimationFrame(tick)
        }),
      tailFrames
    )
  }

  private async stroke(
    from: ScreenPoint,
    to: ScreenPoint,
    steps: number,
    button: 'left' | 'middle'
  ) {
    const mouse = this.page.mouse
    await mouse.move(from.x, from.y)
    await mouse.down({ button })
    for (let i = 1; i <= steps; i++) {
      await mouse.move(
        from.x + ((to.x - from.x) * i) / steps,
        from.y + ((to.y - from.y) * i) / steps
      )
    }
    await mouse.up({ button })
  }

  /** Middle-button pans across `fraction` of the canvas width and back. */
  async measurePan(fraction: number, stepsPerStroke: number) {
    const box = await this.canvasBox()
    const y = box.y + box.height / 2
    const right = { x: box.x + (box.width * (1 + fraction)) / 2, y }
    const left = { x: box.x + (box.width * (1 - fraction)) / 2, y }
    const before = await this.viewState()
    await this.startFrames()
    await this.stroke(right, left, stepsPerStroke, 'middle')
    const midway = await this.viewState()
    await this.stroke(left, right, stepsPerStroke, 'middle')
    const { costs, intervals } = await this.stopFrames(12)
    expect(
      Math.abs(midway.x - before.x) * midway.scale,
      'the middle-button drag must pan the canvas'
    ).toBeGreaterThan(box.width * fraction * 0.9)
    return { steps: stepsPerStroke * 2, frames: costs, intervals }
  }

  /** Wheel-zooms out from 1.0 across the low-quality threshold and back. */
  async measureZoomSweep() {
    await this.showAt(1)
    const box = await this.canvasBox()
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    let lowest = Infinity
    await this.startFrames()
    for (let i = 0; i < 44; i++) {
      await this.page.mouse.wheel(0, i < 22 ? 100 : -100)
      await this.comfyPage.nextFrame()
      lowest = Math.min(lowest, (await this.viewState()).scale)
    }
    const { costs, intervals } = await this.stopFrames(48)
    expect(
      lowest,
      'the sweep must cross the low-quality zoom threshold'
    ).toBeLessThan(LOW_QUALITY_ZOOM)
    expect(
      (await this.viewState()).scale,
      'the sweep must return above the threshold'
    ).toBeGreaterThan(LOW_QUALITY_ZOOM)
    return { steps: 44, frames: costs, intervals }
  }

  private async nodePositions(ids: readonly string[]) {
    return this.page.evaluate(
      (ids) =>
        ids.map((id) => {
          const node = window.app!.graph.nodes.find(
            (candidate) => String(candidate.id) === id
          )
          if (!node) throw new Error(`node ${id} is missing`)
          return [node.pos[0], node.pos[1]] as const
        }),
      ids
    )
  }

  async selectNearest(nodeId: string, count: number) {
    const ids = await this.page.evaluate(
      ({ nodeId, count }) => {
        const graph = window.app!.graph
        const anchor = graph.nodes.find((n) => String(n.id) === nodeId)
        if (!anchor) throw new Error(`node ${nodeId} is missing`)
        const distance = (n: (typeof graph.nodes)[number]) =>
          Math.hypot(n.pos[0] - anchor.pos[0], n.pos[1] - anchor.pos[1])
        const nearest = [...graph.nodes]
          .sort((a, b) => distance(a) - distance(b))
          .slice(0, count)
        window.app!.canvas.selectItems(nearest)
        window.app!.canvas.setDirty(true, true)
        return nearest.map((n) => String(n.id))
      },
      { nodeId, count }
    )
    await this.settle()
    return ids
  }

  /** Drags a node by its title along a fixed loop; asserts every listed node moved. */
  async measureDrag(nodeId: string, movedIds: readonly string[]) {
    const start = await this.titlePoint(nodeId)
    const before = await this.nodePositions(movedIds)
    const steps = 60
    const mouse = this.page.mouse
    await mouse.move(start.x, start.y)
    await this.startFrames()
    await mouse.down()
    for (let i = 0; i < steps; i++) {
      await mouse.move(
        start.x + Math.sin(i / 5) * 150 + 5,
        start.y + Math.cos(i / 5) * 100 - 95
      )
    }
    const during = await this.nodePositions(movedIds)
    await mouse.up()
    const { costs, intervals } = await this.stopFrames(12)
    const moved = during.filter(
      ([x, y], i) => Math.hypot(x - before[i][0], y - before[i][1]) > 1
    ).length
    expect(moved, 'every selected node must follow the drag').toBe(
      movedIds.length
    )
    return { steps, frames: costs, intervals }
  }

  /** Main-thread busy share over `frames` idle frames at the current view. */
  async idleBusyPercent(frames: number) {
    const before = await this.metrics()
    await this.page.evaluate(
      (frames) =>
        new Promise<void>((resolve) => {
          let remaining = frames
          const tick = () => {
            if (--remaining <= 0) resolve()
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }),
      frames
    )
    const after = await this.metrics()
    return round(
      ((after.taskSeconds - before.taskSeconds) * 100) /
        (after.timestampSeconds - before.timestampSeconds),
      2
    )
  }

  /** Types into the central prompt and returns each key's key-to-paint time in ms (Event Timing, 16 ms floor). */
  async measureTyping(keys: number) {
    expect(
      await this.page.evaluate(() =>
        PerformanceObserver.supportedEntryTypes.includes('event')
      ),
      'the browser must support Event Timing'
    ).toBe(true)
    const node = await this.centralNode('CLIPTextEncode')
    await this.showAt(1, {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2
    })
    const box = await this.canvasBox()
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    const initial = await this.page.evaluate(() => {
      const active = document.activeElement
      return active instanceof HTMLTextAreaElement ? active.value : null
    })
    expect(initial, 'the prompt textarea must take focus').not.toBeNull()
    const typed = 'abcdefghij'.repeat(Math.ceil(keys / 10)).slice(0, keys)
    await this.startFrames()
    for (const key of typed) {
      await this.page.keyboard.press(key)
      await this.comfyPage.nextFrame()
    }
    const { keyLatencies } = await this.stopFrames(12)
    const value = await this.page.evaluate(() => {
      const active = document.activeElement
      return active instanceof HTMLTextAreaElement ? active.value : null
    })
    expect(value, 'every key must reach the textarea').toBe(
      `${initial}${typed}`
    )
    expect(
      keyLatencies.length,
      'no more reported keys than typed'
    ).toBeLessThanOrEqual(keys)
    return [
      ...keyLatencies,
      ...Array.from({ length: keys - keyLatencies.length }, () => 16)
    ]
  }

  /** Visits every viewport of the graph at working zoom, then returns to the start view. */
  async visitWholeGraph() {
    const bounds = await this.graphBounds()
    const box = await this.canvasBox()
    const stepX = box.width / WORKING_ZOOM
    const stepY = box.height / WORKING_ZOOM
    let visited = 0
    for (
      let y = bounds.minY + stepY / 2;
      y < bounds.maxY + stepY / 2;
      y += stepY
    ) {
      for (
        let x = bounds.minX + stepX / 2;
        x < bounds.maxX + stepX / 2;
        x += stepX
      ) {
        await this.showAt(WORKING_ZOOM, { x, y })
        visited++
      }
    }
    await this.showAt(WORKING_ZOOM)
    return visited
  }
}
