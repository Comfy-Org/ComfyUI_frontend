import type { CDPSession, Page } from '@playwright/test'

interface PerfSnapshot {
  RecalcStyleCount: number
  RecalcStyleDuration: number
  LayoutCount: number
  LayoutDuration: number
  TaskDuration: number
  JSHeapUsedSize: number
  Timestamp: number
  Nodes: number
  JSHeapTotalSize: number
  ScriptDuration: number
  JSEventListeners: number
  TaskOtherDuration: number
  V8CompileDuration: number
  DevToolsCommandDuration: number
  ThreadTime: number
  ProcessTime: number
}

interface PerfRunIdentity {
  gitSha: string
  browserVersion: string
  userAgent: string
  url: string
  viewport: { width: number; height: number } | null
  deviceScaleFactor: number
  visibilityState: string
  graphHash: string
  graphNodes: number
  graphLinks: number
  canvasWidth: number
  canvasHeight: number
  visibleNodes: number
  backgroundIsFrontCanvas: boolean
  hasOverlayCanvas: boolean
  alwaysRenderBackground: boolean
}

interface PerfWorkloadCounters {
  emitted: Record<string, number>
  apiDispatched: Record<string, number>
  dirtyCalls: number
  dirtyForegroundRequests: number
  dirtyBackgroundRequests: number
  frontDraws: number
  backDraws: number
  observedProgressStateChanges: number
}

export interface PerfMeasurement {
  name: string
  durationMs: number
  styleRecalcs: number
  styleRecalcDurationMs: number
  layouts: number
  layoutDurationMs: number
  taskDurationMs: number
  taskOtherDurationMs: number
  v8CompileDurationMs: number
  devToolsCommandDurationMs: number
  threadTimeMs: number
  processTimeMs: number
  taskUtilization: number
  threadUtilization: number
  processUtilization: number
  taskAccountingErrorMs: number
  heapDeltaBytes: number
  heapUsedBytes: number
  domNodes: number
  jsHeapTotalBytes: number
  scriptDurationMs: number
  eventListeners: number
  totalBlockingTimeMs: number
  frameDurationMs: number
  p95FrameDurationMs: number
  p99FrameDurationMs: number
  maxFrameDurationMs: number
  framesOver16Ms: number
  framesOver33Ms: number
  framesOver50Ms: number
  allFrameDurationsMs: number[]
  metricNames: string[]
  identity: PerfRunIdentity
  counters: PerfWorkloadCounters
}

export class PerformanceHelper {
  private cdp: CDPSession | null = null
  private snapshot: PerfSnapshot | null = null
  private metricNames: string[] = []
  private emitted: Record<string, number> = {}

  constructor(private readonly page: Page) {}

  async init(): Promise<void> {
    this.cdp = await this.page.context().newCDPSession(this.page)
    await this.cdp.send('Performance.enable', { timeDomain: 'timeTicks' })
  }

  async dispose(): Promise<void> {
    this.snapshot = null
    if (this.cdp) {
      try {
        await this.cdp.send('Performance.disable')
      } finally {
        await this.cdp.detach()
        this.cdp = null
      }
    }
  }

  private async getSnapshot(): Promise<PerfSnapshot> {
    if (!this.cdp) throw new Error('PerformanceHelper not initialized')
    const { metrics } = (await this.cdp.send('Performance.getMetrics')) as {
      metrics: { name: string; value: number }[]
    }
    this.metricNames = metrics.map(({ name }) => name).sort()
    function requireMetric(name: string): number {
      const metric = metrics.find((item) => item.name === name)
      if (!metric) throw new Error(`Required CDP metric missing: ${name}`)
      return metric.value
    }
    return {
      RecalcStyleCount: requireMetric('RecalcStyleCount'),
      RecalcStyleDuration: requireMetric('RecalcStyleDuration'),
      LayoutCount: requireMetric('LayoutCount'),
      LayoutDuration: requireMetric('LayoutDuration'),
      TaskDuration: requireMetric('TaskDuration'),
      JSHeapUsedSize: requireMetric('JSHeapUsedSize'),
      Timestamp: requireMetric('Timestamp'),
      Nodes: requireMetric('Nodes'),
      JSHeapTotalSize: requireMetric('JSHeapTotalSize'),
      ScriptDuration: requireMetric('ScriptDuration'),
      JSEventListeners: requireMetric('JSEventListeners'),
      TaskOtherDuration: requireMetric('TaskOtherDuration'),
      V8CompileDuration: requireMetric('V8CompileDuration'),
      DevToolsCommandDuration: requireMetric('DevToolsCommandDuration'),
      ThreadTime: requireMetric('ThreadTime'),
      ProcessTime: requireMetric('ProcessTime')
    }
  }

  noteEmitted(type: string, count = 1): void {
    this.emitted[type] = (this.emitted[type] ?? 0) + count
  }

  /**
   * Collect longtask entries from PerformanceObserver and compute TBT.
   * TBT = sum of (duration - 50ms) for every task longer than 50ms.
   */
  private async collectTBT(): Promise<number> {
    return this.page.evaluate(() => {
      const state = (window as unknown as Record<string, unknown>)
        .__perfLongtaskState as
        | { observer: PerformanceObserver; tbtMs: number }
        | undefined
      if (!state) return 0

      // Flush any queued-but-undelivered entries into our accumulator
      for (const entry of state.observer.takeRecords()) {
        if (entry.duration > 50) state.tbtMs += entry.duration - 50
      }
      const result = state.tbtMs
      state.tbtMs = 0
      return result
    })
  }

  async startMeasuring(): Promise<void> {
    if (this.snapshot) {
      throw new Error(
        'Measurement already in progress — call stopMeasuring() first'
      )
    }
    // Install longtask observer if not already present, then reset the
    // accumulator so old longtasks don't bleed into the new measurement window.
    this.emitted = {}
    await this.page.evaluate(() => {
      const win = window as unknown as Record<string, unknown>
      if (!win.__perfLongtaskState) {
        const state: { observer: PerformanceObserver; tbtMs: number } = {
          observer: new PerformanceObserver((list) => {
            const self = (window as unknown as Record<string, unknown>)
              .__perfLongtaskState as {
              observer: PerformanceObserver
              tbtMs: number
            }
            for (const entry of list.getEntries()) {
              if (entry.duration > 50) self.tbtMs += entry.duration - 50
            }
          }),
          tbtMs: 0
        }
        state.observer.observe({ type: 'longtask', buffered: true })
        win.__perfLongtaskState = state
      }
      const state = win.__perfLongtaskState as {
        observer: PerformanceObserver
        tbtMs: number
      }
      state.tbtMs = 0
      state.observer.takeRecords()

      const frameState = {
        active: true,
        timestamps: [] as number[],
        observedProgressStateChanges: 0,
        lastProgressState: ''
      }
      win.__perfFrameState = frameState
      const app = win.app as
        | {
            api?: EventTarget
            canvas?: {
              setDirty: (foreground: boolean, background?: boolean) => void
              drawFrontCanvas: () => void
              drawBackCanvas: () => void
            }
          }
        | undefined
      const counters = {
        apiDispatched: {} as Record<string, number>,
        dirtyCalls: 0,
        dirtyForegroundRequests: 0,
        dirtyBackgroundRequests: 0,
        frontDraws: 0,
        backDraws: 0
      }
      const eventTypes = ['progress', 'progress_state']
      const listeners = eventTypes.map((type) => {
        const listener = () => {
          counters.apiDispatched[type] = (counters.apiDispatched[type] ?? 0) + 1
        }
        app?.api?.addEventListener(type, listener)
        return { type, listener }
      })
      const canvas = app?.canvas
      const originals = canvas
        ? {
            setDirty: canvas.setDirty,
            drawFrontCanvas: canvas.drawFrontCanvas,
            drawBackCanvas: canvas.drawBackCanvas
          }
        : null
      if (canvas && originals) {
        canvas.setDirty = (foreground, background) => {
          counters.dirtyCalls++
          if (foreground) counters.dirtyForegroundRequests++
          if (background) counters.dirtyBackgroundRequests++
          originals.setDirty.call(canvas, foreground, background)
        }
        canvas.drawFrontCanvas = () => {
          counters.frontDraws++
          originals.drawFrontCanvas.call(canvas)
        }
        canvas.drawBackCanvas = () => {
          counters.backDraws++
          originals.drawBackCanvas.call(canvas)
        }
      }
      win.__perfWorkloadState = { counters, listeners, canvas, originals }
      const tick = (timestamp: number) => {
        if (!frameState.active) return
        frameState.timestamps.push(timestamp)
        const graph = (win.app as { graph?: { nodes?: unknown[] } } | undefined)
          ?.graph
        const signature = JSON.stringify(
          graph?.nodes?.map((node) => {
            const item = node as { id?: unknown; progress?: unknown }
            return [item.id, item.progress]
          }) ?? []
        )
        if (frameState.lastProgressState && signature !== frameState.lastProgressState)
          frameState.observedProgressStateChanges++
        frameState.lastProgressState = signature
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    this.snapshot = await this.getSnapshot()
  }

  async stopMeasuring(name: string): Promise<PerfMeasurement> {
    if (!this.snapshot) throw new Error('Call startMeasuring() first')
    const pageResult = await this.page.evaluate(async () => {
      const win = window as unknown as Record<string, unknown>
      const state = (window as unknown as Record<string, unknown>)
        .__perfFrameState as
        | {
            active: boolean
            timestamps: number[]
            observedProgressStateChanges: number
          }
        | undefined
      if (!state) throw new Error('Frame instrumentation missing')
      state.active = false
      const durations: number[] = []
      for (let i = 1; i < state.timestamps.length; i++) {
        durations.push(state.timestamps[i] - state.timestamps[i - 1])
      }
      const workload = win.__perfWorkloadState as {
        counters: Omit<PerfWorkloadCounters, 'emitted' | 'observedProgressStateChanges'>
        listeners: { type: string; listener: EventListener }[]
        canvas?: {
          setDirty: (foreground: boolean, background?: boolean) => void
          drawFrontCanvas: () => void
          drawBackCanvas: () => void
        }
        originals?: {
          setDirty: (foreground: boolean, background?: boolean) => void
          drawFrontCanvas: () => void
          drawBackCanvas: () => void
        }
      }
      const app = win.app as
        | {
            api?: EventTarget
            graph?: { nodes?: unknown[]; links?: Map<unknown, unknown> | object }
            canvas?: {
              canvas?: HTMLCanvasElement
              bgcanvas?: HTMLCanvasElement
              overlayCanvas?: HTMLCanvasElement | null
              visible_nodes?: unknown[]
              always_render_background?: boolean
            }
          }
        | undefined
      for (const { type, listener } of workload.listeners)
        app?.api?.removeEventListener(type, listener)
      if (workload.canvas && workload.originals) {
        workload.canvas.setDirty = workload.originals.setDirty
        workload.canvas.drawFrontCanvas = workload.originals.drawFrontCanvas
        workload.canvas.drawBackCanvas = workload.originals.drawBackCanvas
      }
      const nodes = app?.graph?.nodes ?? []
      const links = app?.graph?.links
      const graphDescription = JSON.stringify(
        nodes.map((node) => {
          const item = node as {
            id?: unknown
            type?: unknown
            pos?: unknown
            size?: unknown
          }
          return [item.id, item.type, item.pos, item.size]
        })
      )
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(graphDescription)
      )
      const graphHash = Array.from(new Uint8Array(hashBuffer))
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
      const canvas = app?.canvas?.canvas
      return {
        durations,
        counters: {
          ...workload.counters,
          observedProgressStateChanges: state.observedProgressStateChanges
        },
        identity: {
          userAgent: navigator.userAgent,
          url: location.href,
          viewport: { width: innerWidth, height: innerHeight },
          deviceScaleFactor: devicePixelRatio,
          visibilityState: document.visibilityState,
          graphHash,
          graphNodes: nodes.length,
          graphLinks:
            links instanceof Map ? links.size : Object.keys(links ?? {}).length,
          canvasWidth: canvas?.width ?? 0,
          canvasHeight: canvas?.height ?? 0,
          visibleNodes: app?.canvas?.visible_nodes?.length ?? 0,
          backgroundIsFrontCanvas: app?.canvas?.bgcanvas === canvas,
          hasOverlayCanvas: !!app?.canvas?.overlayCanvas,
          alwaysRenderBackground: !!app?.canvas?.always_render_background
        }
      }
    })
    const allFrameDurationsMs = pageResult.durations
    const after = await this.getSnapshot()
    const before = this.snapshot
    this.snapshot = null

    function delta(key: keyof PerfSnapshot): number {
      return after[key] - before[key]
    }

    const totalBlockingTimeMs = await this.collectTBT()

    const frameDurationMs =
      allFrameDurationsMs.length > 0
        ? allFrameDurationsMs.reduce((a, b) => a + b, 0) /
          allFrameDurationsMs.length
        : 0

    const sorted = [...allFrameDurationsMs].sort((a, b) => a - b)
    const p95FrameDurationMs =
      sorted.length > 0 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : 0
    const p99FrameDurationMs =
      sorted.length > 0 ? sorted[Math.ceil(sorted.length * 0.99) - 1] : 0
    const maxFrameDurationMs = sorted.at(-1) ?? 0
    const durationMs = delta('Timestamp') * 1000
    const taskDurationMs = delta('TaskDuration') * 1000
    const taskOtherDurationMs = delta('TaskOtherDuration') * 1000
    const v8CompileDurationMs = delta('V8CompileDuration') * 1000
    const devToolsCommandDurationMs = delta('DevToolsCommandDuration') * 1000
    const threadTimeMs = delta('ThreadTime') * 1000
    const processTimeMs = delta('ProcessTime') * 1000
    const taskAccountingErrorMs =
      taskDurationMs -
      (delta('ScriptDuration') * 1000 +
        v8CompileDurationMs +
        delta('RecalcStyleDuration') * 1000 +
        delta('LayoutDuration') * 1000 +
        devToolsCommandDurationMs +
        taskOtherDurationMs)
    if (Math.abs(taskAccountingErrorMs) > 0.5) {
      throw new Error(
        `CDP task accounting mismatch: ${taskAccountingErrorMs.toFixed(3)}ms`
      )
    }
    const browserVersion =
      this.page.context().browser()?.version() ?? 'unknown-browser'

    return {
      name,
      durationMs,
      styleRecalcs: delta('RecalcStyleCount'),
      styleRecalcDurationMs: delta('RecalcStyleDuration') * 1000,
      layouts: delta('LayoutCount'),
      layoutDurationMs: delta('LayoutDuration') * 1000,
      taskDurationMs,
      taskOtherDurationMs,
      v8CompileDurationMs,
      devToolsCommandDurationMs,
      threadTimeMs,
      processTimeMs,
      taskUtilization: taskDurationMs / durationMs,
      threadUtilization: threadTimeMs / durationMs,
      processUtilization: processTimeMs / durationMs,
      taskAccountingErrorMs,
      heapDeltaBytes: delta('JSHeapUsedSize'),
      heapUsedBytes: after.JSHeapUsedSize,
      domNodes: delta('Nodes'),
      jsHeapTotalBytes: delta('JSHeapTotalSize'),
      scriptDurationMs: delta('ScriptDuration') * 1000,
      eventListeners: delta('JSEventListeners'),
      totalBlockingTimeMs,
      frameDurationMs,
      p95FrameDurationMs,
      p99FrameDurationMs,
      maxFrameDurationMs,
      framesOver16Ms: allFrameDurationsMs.filter((value) => value > 16.67)
        .length,
      framesOver33Ms: allFrameDurationsMs.filter((value) => value > 33.33)
        .length,
      framesOver50Ms: allFrameDurationsMs.filter((value) => value > 50).length,
      allFrameDurationsMs,
      metricNames: this.metricNames,
      identity: {
        gitSha: process.env.PERF_GIT_SHA ?? 'unknown',
        browserVersion,
        ...pageResult.identity
      },
      counters: {
        emitted: { ...this.emitted },
        ...pageResult.counters
      }
    }
  }
}
