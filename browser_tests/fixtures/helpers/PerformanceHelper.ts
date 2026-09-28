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
}

export interface PerfMeasurement {
  name: string
  durationMs: number
  styleRecalcs: number
  styleRecalcDurationMs: number
  layouts: number
  layoutDurationMs: number
  taskDurationMs: number
  heapDeltaBytes: number
  heapUsedBytes: number
  domNodes: number
  jsHeapTotalBytes: number
  scriptDurationMs: number
  eventListeners: number
  totalBlockingTimeMs: number
  frameDurationMs: number
  p95FrameDurationMs: number
  allFrameDurationsMs: number[]
}

export class PerformanceHelper {
  private cdp: CDPSession | null = null
  private snapshot: PerfSnapshot | null = null

  constructor(private readonly page: Page) {}

  async init(): Promise<void> {
    this.cdp = await this.page.context().newCDPSession(this.page)
    await this.cdp.send('Performance.enable')
  }

  async dispose(): Promise<void> {
    const measurementInProgress = this.snapshot !== null
    this.snapshot = null
    try {
      if (measurementInProgress && !this.page.isClosed()) {
        await this.stopFrameMeasurement()
      }
    } finally {
      if (this.cdp) {
        try {
          await this.cdp.send('Performance.disable')
        } finally {
          await this.cdp.detach()
          this.cdp = null
        }
      }
    }
  }

  private async getSnapshot(): Promise<PerfSnapshot> {
    if (!this.cdp) throw new Error('PerformanceHelper not initialized')
    const { metrics } = await this.cdp.send('Performance.getMetrics')
    function get(name: string): number {
      return metrics.find((m) => m.name === name)?.value ?? 0
    }
    return {
      RecalcStyleCount: get('RecalcStyleCount'),
      RecalcStyleDuration: get('RecalcStyleDuration'),
      LayoutCount: get('LayoutCount'),
      LayoutDuration: get('LayoutDuration'),
      TaskDuration: get('TaskDuration'),
      JSHeapUsedSize: get('JSHeapUsedSize'),
      Timestamp: get('Timestamp'),
      Nodes: get('Nodes'),
      JSHeapTotalSize: get('JSHeapTotalSize'),
      ScriptDuration: get('ScriptDuration'),
      JSEventListeners: get('JSEventListeners')
    }
  }

  /**
   * Collect longtask entries from PerformanceObserver and compute TBT.
   * TBT = sum of (duration - 50ms) for every task longer than 50ms.
   */
  private async collectTBT(): Promise<number> {
    return this.page.evaluate(() => {
      const state = window.__perfLongtaskState
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

  private async startFrameMeasurement(): Promise<void> {
    await this.page.evaluate(async () => {
      const state: NonNullable<Window['__perfFrameState']> = {
        frameRequestId: 0,
        lastTimestamp: null,
        durationsMs: []
      }

      function tick(timestamp: number) {
        if (state.lastTimestamp !== null) {
          state.durationsMs.push(timestamp - state.lastTimestamp)
        }
        state.lastTimestamp = timestamp
        state.frameRequestId = requestAnimationFrame(tick)
      }

      window.__perfFrameState = state
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          cancelAnimationFrame(state.frameRequestId)
          delete window.__perfFrameState
          reject(new Error('Timed out waiting for the initial animation frame'))
        }, 1_000)
        state.frameRequestId = requestAnimationFrame((timestamp) => {
          window.clearTimeout(timeoutId)
          state.lastTimestamp = timestamp
          state.frameRequestId = requestAnimationFrame(tick)
          resolve()
        })
      })
    })
  }

  private async stopFrameMeasurement(): Promise<number[]> {
    if (this.page.isClosed()) return []
    try {
      return await this.page.evaluate(async () => {
        const state = window.__perfFrameState
        if (!state) return []

        cancelAnimationFrame(state.frameRequestId)
        return new Promise<number[]>((resolve) => {
          let finished = false
          const finish = (timestamp?: number) => {
            if (finished) return
            finished = true
            window.clearTimeout(timeoutId)
            cancelAnimationFrame(state.frameRequestId)
            if (timestamp !== undefined && state.lastTimestamp !== null) {
              state.durationsMs.push(timestamp - state.lastTimestamp)
            }
            delete window.__perfFrameState
            resolve(state.durationsMs)
          }
          const timeoutId = window.setTimeout(() => finish(), 1_000)
          state.frameRequestId = requestAnimationFrame(finish)
        })
      })
    } catch (error) {
      if (this.page.isClosed()) return []
      throw error
    }
  }

  async startMeasuring(): Promise<void> {
    if (this.snapshot) {
      throw new Error(
        'Measurement already in progress — call stopMeasuring() first'
      )
    }
    // Install longtask observer if not already present, then reset the
    // accumulator so old longtasks don't bleed into the new measurement window.
    await this.page.evaluate(() => {
      if (!window.__perfLongtaskState) {
        const state: NonNullable<Window['__perfLongtaskState']> = {
          observer: new PerformanceObserver((list) => {
            const self = window.__perfLongtaskState
            if (!self) return
            for (const entry of list.getEntries()) {
              if (entry.duration > 50) self.tbtMs += entry.duration - 50
            }
          }),
          tbtMs: 0
        }
        state.observer.observe({ type: 'longtask', buffered: true })
        window.__perfLongtaskState = state
      }
      const state = window.__perfLongtaskState
      state.tbtMs = 0
      state.observer.takeRecords()
    })
    this.snapshot = await this.getSnapshot()
    await this.startFrameMeasurement()
  }

  async stopMeasuring(name: string): Promise<PerfMeasurement> {
    if (!this.snapshot) throw new Error('Call startMeasuring() first')
    const [after, allFrameDurationsMs] = await Promise.all([
      this.getSnapshot(),
      this.stopFrameMeasurement()
    ])
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

    return {
      name,
      durationMs: delta('Timestamp') * 1000,
      styleRecalcs: delta('RecalcStyleCount'),
      styleRecalcDurationMs: delta('RecalcStyleDuration') * 1000,
      layouts: delta('LayoutCount'),
      layoutDurationMs: delta('LayoutDuration') * 1000,
      taskDurationMs: delta('TaskDuration') * 1000,
      heapDeltaBytes: delta('JSHeapUsedSize'),
      heapUsedBytes: after.JSHeapUsedSize,
      domNodes: delta('Nodes'),
      jsHeapTotalBytes: delta('JSHeapTotalSize'),
      scriptDurationMs: delta('ScriptDuration') * 1000,
      eventListeners: delta('JSEventListeners'),
      totalBlockingTimeMs,
      frameDurationMs,
      p95FrameDurationMs,
      allFrameDurationsMs
    }
  }
}
