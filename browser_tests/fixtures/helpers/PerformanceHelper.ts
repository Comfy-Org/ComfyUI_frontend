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

export interface FPSResult {
  p5: number
  p50: number
  p95: number
  mean: number
  frameCount: number
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
  fpsP5?: number
  fpsP50?: number
  fpsMean?: number
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

  /**
   * Measure average frame duration via rAF timing over a sample window.
   * Returns average ms per frame (lower = better, 16.67 = 60fps).
   */
  private async measureFrameDuration(sampleFrames = 10): Promise<number> {
    return this.page.evaluate((frames) => {
      return new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(0), 5000)
        const timestamps: number[] = []
        let count = 0
        function tick(ts: number) {
          timestamps.push(ts)
          count++
          if (count <= frames) {
            requestAnimationFrame(tick)
          } else {
            clearTimeout(timeout)
            if (timestamps.length < 2) {
              resolve(0)
              return
            }
            const total = timestamps[timestamps.length - 1] - timestamps[0]
            resolve(total / (timestamps.length - 1))
          }
        }
        requestAnimationFrame(tick)
      })
    }, sampleFrames)
  }

  async measureFPS(durationMs: number): Promise<FPSResult> {
    return this.page.evaluate((duration) => {
      return new Promise<FPSResult>((resolve) => {
        const frameDurations: number[] = []
        let lastTime = 0
        const start = performance.now()
        let settled = false
        const timeout = setTimeout(() => {
          if (settled) return
          settled = true
          resolve({ p5: 0, p50: 0, p95: 0, mean: 0, frameCount: 0 })
        }, duration + 5000)

        function tick(now: number) {
          if (settled) return
          if (lastTime > 0) frameDurations.push(now - lastTime)
          lastTime = now
          if (now - start < duration) {
            requestAnimationFrame(tick)
          } else {
            settled = true
            clearTimeout(timeout)
            if (frameDurations.length === 0) {
              resolve({ p5: 0, p50: 0, p95: 0, mean: 0, frameCount: 0 })
              return
            }
            const fps = frameDurations
              .map((d) => 1000 / d)
              .filter((f) => Number.isFinite(f))
            fps.sort((a, b) => a - b)
            if (fps.length === 0) {
              resolve({ p5: 0, p50: 0, p95: 0, mean: 0, frameCount: 0 })
              return
            }
            function percentile(p: number): number {
              const rank = p * (fps.length - 1)
              const lo = Math.floor(rank)
              const hi = Math.ceil(rank)
              const weight = rank - lo
              const loVal = fps[lo] ?? 0
              const hiVal = fps[hi] ?? loVal
              return loVal + (hiVal - loVal) * weight
            }
            resolve({
              p5: percentile(0.05),
              p50: percentile(0.5),
              p95: percentile(0.95),
              mean: fps.reduce((a, b) => a + b, 0) / fps.length,
              frameCount: fps.length
            })
          }
        }
        requestAnimationFrame(tick)
      })
    }, durationMs)
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
    })
    this.snapshot = await this.getSnapshot()
  }

  async stopMeasuring(name: string): Promise<PerfMeasurement> {
    if (!this.snapshot) throw new Error('Call startMeasuring() first')
    const after = await this.getSnapshot()
    const before = this.snapshot
    this.snapshot = null

    function delta(key: keyof PerfSnapshot): number {
      return after[key] - before[key]
    }

    const [totalBlockingTimeMs, frameDurationMs] = await Promise.all([
      this.collectTBT(),
      this.measureFrameDuration()
    ])

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
      frameDurationMs
    }
  }
}
