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
  domNodes: number
  jsHeapTotalBytes: number
  scriptDurationMs: number
  eventListeners: number
  totalBlockingTimeMs: number
  frameDurationMs: number
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
      const entries = performance.getEntriesByType(
        'longtask'
      ) as PerformanceEntry[]
      let tbt = 0
      for (const entry of entries) {
        if (entry.duration > 50) {
          tbt += entry.duration - 50
        }
      }
      return tbt
    })
  }

  /**
   * Measure average frame duration via rAF timing over a sample window.
   * Returns average ms per frame (lower = better, 16.67 = 60fps).
   */
  private async measureFrameDuration(sampleFrames = 10): Promise<number> {
    return this.page.evaluate((frames) => {
      return new Promise<number>((resolve) => {
        const timestamps: number[] = []
        let count = 0
        function tick(ts: number) {
          timestamps.push(ts)
          count++
          if (count <= frames) {
            requestAnimationFrame(tick)
          } else {
            if (timestamps.length < 2) {
              resolve(0)
              return
            }
            const total =
              timestamps[timestamps.length - 1] - timestamps[0]
            resolve(total / (timestamps.length - 1))
          }
        }
        requestAnimationFrame(tick)
      })
    }, sampleFrames)
  }

  async startMeasuring(): Promise<void> {
    if (this.snapshot) {
      throw new Error(
        'Measurement already in progress — call stopMeasuring() first'
      )
    }
    // Clear longtask entries before measurement window
    await this.page.evaluate(() => {
      performance.clearResourceTimings()
      // Install longtask observer if not already present
      if (!(window as Record<string, unknown>).__perfLongtaskObserver) {
        const observer = new PerformanceObserver(() => {
          // entries buffered automatically
        })
        observer.observe({ type: 'longtask', buffered: true })
        ;(window as Record<string, unknown>).__perfLongtaskObserver = observer
      }
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
      domNodes: delta('Nodes'),
      jsHeapTotalBytes: delta('JSHeapTotalSize'),
      scriptDurationMs: delta('ScriptDuration') * 1000,
      eventListeners: delta('JSEventListeners'),
      totalBlockingTimeMs,
      frameDurationMs
    }
  }
}
