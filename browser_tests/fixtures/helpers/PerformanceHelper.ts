import type { CDPSession, Page } from '@playwright/test'

export interface PerfSnapshot {
  RecalcStyleCount: number
  RecalcStyleDuration: number
  LayoutCount: number
  LayoutDuration: number
  TaskDuration: number
  JSHeapUsedSize: number
  Timestamp: number
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
    if (this.cdp) {
      await this.cdp.send('Performance.disable')
      await this.cdp.detach()
      this.cdp = null
    }
  }

  private async getSnapshot(): Promise<PerfSnapshot> {
    if (!this.cdp) throw new Error('PerformanceHelper not initialized')
    const { metrics } = await this.cdp.send('Performance.getMetrics')
    const get = (name: string) =>
      metrics.find((m) => m.name === name)?.value ?? 0
    return {
      RecalcStyleCount: get('RecalcStyleCount'),
      RecalcStyleDuration: get('RecalcStyleDuration'),
      LayoutCount: get('LayoutCount'),
      LayoutDuration: get('LayoutDuration'),
      TaskDuration: get('TaskDuration'),
      JSHeapUsedSize: get('JSHeapUsedSize'),
      Timestamp: get('Timestamp')
    }
  }

  async startMeasuring(): Promise<void> {
    this.snapshot = await this.getSnapshot()
  }

  async stopMeasuring(name: string): Promise<PerfMeasurement> {
    if (!this.snapshot) throw new Error('Call startMeasuring() first')
    const after = await this.getSnapshot()
    const before = this.snapshot
    this.snapshot = null
    return {
      name,
      durationMs: (after.Timestamp - before.Timestamp) * 1000,
      styleRecalcs: after.RecalcStyleCount - before.RecalcStyleCount,
      styleRecalcDurationMs:
        (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
      layouts: after.LayoutCount - before.LayoutCount,
      layoutDurationMs:
        (after.LayoutDuration - before.LayoutDuration) * 1000,
      taskDurationMs: (after.TaskDuration - before.TaskDuration) * 1000,
      heapDeltaBytes: after.JSHeapUsedSize - before.JSHeapUsedSize
    }
  }
}
