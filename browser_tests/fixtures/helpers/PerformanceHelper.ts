import type { CDPSession, Page } from '@playwright/test'

import type { CdpMetricSnapshot } from '@/utils/cdpPerformanceMetrics'
import {
  computeCdpTaskAccounting,
  parseCdpMetrics,
  requireCdpMetric
} from '@/utils/cdpPerformanceMetrics'
import type {
  PerfActivityIdentity,
  PerfIdentitySource,
  PerfWorkloadIdentity
} from '@e2e/fixtures/helpers/perfWorkloadIdentity'
import { buildPerfWorkloadIdentity } from '@e2e/fixtures/helpers/perfWorkloadIdentity'

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
  cdpMetrics: CdpMetricSnapshot
}

interface RafCollectorState {
  intervalsMs: number[]
  lastTimestamp: number | null
  requestId: number | null
  running: boolean
  startVisibility: DocumentVisibilityState
}

interface RafCollection {
  intervalsMs: number[]
  startVisibility: DocumentVisibilityState
  endVisibility: DocumentVisibilityState
}

export interface RafIntervalMetrics {
  rafIntervalCount: number
  rafIntervalP50Ms: number
  rafIntervalP95Ms: number
  rafIntervalP99Ms: number
  rafIntervalMaxMs: number
  rafIntervalsOver8_33Ms: number
  rafIntervalsOver16_67Ms: number
  rafIntervalsOver33_3Ms: number
  rafIntervalsOver50Ms: number
}

export interface PerfMeasurement extends RafIntervalMetrics {
  name: string
  durationMs: number
  styleRecalcs: number
  styleRecalcDurationMs: number
  layouts: number
  layoutDurationMs: number
  taskDurationMs: number
  /** Chromium's residual task bucket; not proof of native execution. */
  taskOtherDurationMs: number | null
  v8CompileDurationMs: number | null
  devToolsCommandDurationMs: number | null
  /** Renderer main-thread CPU time, when Chromium exposes it. */
  threadTimeMs: number | null
  /** CPU time across the renderer process, not just this page or thread. */
  processTimeMs: number | null
  accountedTaskDurationMs: number | null
  /** Arithmetic drift after all Chromium task buckets, not work attribution. */
  taskAccountingResidualMs: number | null
  missingCdpMetrics: string[]
  nonMonotonicCdpMetrics: string[]
  heapDeltaBytes: number
  heapUsedBytes: number
  domNodes: number
  jsHeapTotalBytes: number
  scriptDurationMs: number
  eventListeners: number
  totalBlockingTimeMs: number
  rafIntervalsMs: number[]
  rejectedRunReason: string | null
  workloadIdentity: PerfWorkloadIdentity
}

const RAF_STATE_KEY = '__perfRafCollectorState'

function percentile(sortedValues: number[], quantile: number): number {
  if (sortedValues.length === 0) return 0
  return sortedValues[Math.ceil(sortedValues.length * quantile) - 1]
}

export function summarizeRafIntervals(
  intervalsMs: number[]
): RafIntervalMetrics {
  const sorted = [...intervalsMs].sort((a, b) => a - b)
  return {
    rafIntervalCount: intervalsMs.length,
    rafIntervalP50Ms: percentile(sorted, 0.5),
    rafIntervalP95Ms: percentile(sorted, 0.95),
    rafIntervalP99Ms: percentile(sorted, 0.99),
    rafIntervalMaxMs: sorted.at(-1) ?? 0,
    rafIntervalsOver8_33Ms: intervalsMs.filter((value) => value > 8.33).length,
    rafIntervalsOver16_67Ms: intervalsMs.filter((value) => value > 16.67)
      .length,
    rafIntervalsOver33_3Ms: intervalsMs.filter((value) => value > 33.3).length,
    rafIntervalsOver50Ms: intervalsMs.filter((value) => value > 50).length
  }
}

export class PerformanceHelper {
  private cdp: CDPSession | null = null
  private snapshot: PerfSnapshot | null = null

  constructor(private readonly page: Page) {}

  async init(): Promise<void> {
    this.cdp = await this.page.context().newCDPSession(this.page)
    await this.cdp.send('Performance.enable', { timeDomain: 'timeTicks' })
  }

  async dispose(): Promise<void> {
    this.snapshot = null
    await this.stopRafCollectorIfRunning()
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
    const cdpMetrics = parseCdpMetrics(metrics)
    const get = (name: string) => requireCdpMetric(cdpMetrics, name)
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
      JSEventListeners: get('JSEventListeners'),
      cdpMetrics
    }
  }

  private async collectTBT(): Promise<number> {
    return this.page.evaluate(() => {
      const state = (window as unknown as Record<string, unknown>)
        .__perfLongtaskState as
        | { observer: PerformanceObserver; tbtMs: number }
        | undefined
      if (!state) return 0

      for (const entry of state.observer.takeRecords()) {
        if (entry.duration > 50) state.tbtMs += entry.duration - 50
      }
      const result = state.tbtMs
      state.tbtMs = 0
      return result
    })
  }

  private async startRafCollector(): Promise<void> {
    await this.page.evaluate((stateKey) => {
      const win = window as unknown as Record<string, unknown>
      if (win[stateKey]) throw new Error('rAF measurement already in progress')

      return new Promise<void>((resolve) => {
        const state: RafCollectorState = {
          intervalsMs: [],
          lastTimestamp: null,
          requestId: null,
          running: true,
          startVisibility: document.visibilityState
        }
        win[stateKey] = state

        const tick = (timestamp: number) => {
          if (!state.running) return
          if (state.lastTimestamp !== null) {
            state.intervalsMs.push(timestamp - state.lastTimestamp)
          }
          state.lastTimestamp = timestamp
          state.requestId = requestAnimationFrame(tick)
          resolve()
        }
        state.requestId = requestAnimationFrame(tick)
      })
    }, RAF_STATE_KEY)
  }

  private async stopRafCollectorIfRunning(): Promise<RafCollection | null> {
    return this.page.evaluate((stateKey) => {
      const win = window as unknown as Record<string, unknown>
      const state = win[stateKey] as RafCollectorState | undefined
      if (!state) return null

      return new Promise<RafCollection>((resolve) => {
        if (state.requestId !== null) cancelAnimationFrame(state.requestId)
        const finish = (timestamp: number) => {
          if (state.lastTimestamp !== null) {
            state.intervalsMs.push(timestamp - state.lastTimestamp)
          }
          state.running = false
          delete win[stateKey]
          resolve({
            intervalsMs: state.intervalsMs,
            startVisibility: state.startVisibility,
            endVisibility: document.visibilityState
          })
        }
        requestAnimationFrame(finish)
      })
    }, RAF_STATE_KEY)
  }

  async startMeasuring(): Promise<void> {
    if (this.snapshot) {
      throw new Error(
        'Measurement already in progress — call stopMeasuring() first'
      )
    }
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
    await this.startRafCollector()
    this.snapshot = await this.getSnapshot()
  }

  async stopMeasuring(name: string): Promise<PerfMeasurement> {
    if (!this.snapshot) throw new Error('Call startMeasuring() first')

    const rafCollection = await this.stopRafCollectorIfRunning()
    const after = await this.getSnapshot()
    const before = this.snapshot
    this.snapshot = null

    function delta(key: Exclude<keyof PerfSnapshot, 'cdpMetrics'>): number {
      return after[key] - before[key]
    }

    const totalBlockingTimeMs = await this.collectTBT()
    const workloadIdentity = await this.collectWorkloadIdentity()
    const taskAccounting = computeCdpTaskAccounting(
      before.cdpMetrics,
      after.cdpMetrics
    )
    const rafIntervalsMs = rafCollection?.intervalsMs ?? []
    const nonMonotonicInterval = rafIntervalsMs.some(
      (duration) => !Number.isFinite(duration) || duration <= 0
    )
    let rejectedRunReason: string | null = null
    if (!rafCollection) rejectedRunReason = 'rAF collector missing at stop'
    else if (
      rafCollection.startVisibility !== 'visible' ||
      rafCollection.endVisibility !== 'visible'
    ) {
      rejectedRunReason = `document visibility changed (${rafCollection.startVisibility} to ${rafCollection.endVisibility})`
    } else if (nonMonotonicInterval) {
      rejectedRunReason = 'rAF timestamps were non-monotonic'
    } else if (rafIntervalsMs.length === 0) {
      rejectedRunReason = 'measurement window contained no rAF intervals'
    }

    return {
      name,
      durationMs: delta('Timestamp') * 1000,
      styleRecalcs: delta('RecalcStyleCount'),
      styleRecalcDurationMs: delta('RecalcStyleDuration') * 1000,
      layouts: delta('LayoutCount'),
      layoutDurationMs: delta('LayoutDuration') * 1000,
      taskDurationMs: delta('TaskDuration') * 1000,
      ...taskAccounting,
      heapDeltaBytes: delta('JSHeapUsedSize'),
      heapUsedBytes: after.JSHeapUsedSize,
      domNodes: delta('Nodes'),
      jsHeapTotalBytes: delta('JSHeapTotalSize'),
      scriptDurationMs: delta('ScriptDuration') * 1000,
      eventListeners: delta('JSEventListeners'),
      totalBlockingTimeMs,
      rafIntervalsMs,
      rejectedRunReason,
      workloadIdentity,
      ...summarizeRafIntervals(rafIntervalsMs)
    }
  }

  private async collectWorkloadIdentity(): Promise<PerfWorkloadIdentity> {
    const browserVersion =
      this.page.context().browser()?.version() ?? 'unavailable'
    const source = await this.page.evaluate(() => {
      const app = window.app
      if (!app) throw new Error('window.app is unavailable for perf identity')
      const graph = app.canvas.graph ?? app.graph
      const nodes = graph.nodes.map((node) => ({
        id: String(node.id),
        inputCount: node.inputs?.length ?? 0,
        outputCount: node.outputs?.length ?? 0,
        widgetCount: node.widgets?.length ?? 0
      }))
      const links = [...graph.links.values()].map((link) => ({
        originId: String(link.origin_id),
        originSlot: link.origin_slot,
        targetId: String(link.target_id),
        targetSlot: link.target_slot
      }))
      const setting = app.extensionManager?.setting
      const vueNodesEnabled =
        setting?.get<boolean>('Comfy.VueNodes.Enabled') ?? false
      const canvasInfoSetting = setting?.get<boolean>('Comfy.Graph.CanvasInfo')
      const canvasInfoEnabled =
        typeof canvasInfoSetting === 'boolean' ? canvasInfoSetting : null
      const renderer: PerfIdentitySource['renderer'] = vueNodesEnabled
        ? 'vue'
        : 'legacy'

      let gpuClass: PerfIdentitySource['gpuClass'] = 'unknown'
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl')
      if (gl) {
        const extension = gl.getExtension('WEBGL_debug_renderer_info')
        const renderer = extension
          ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL))
          : ''
        if (/swiftshader/i.test(renderer)) gpuClass = 'swiftshader'
        else if (/software|llvmpipe/i.test(renderer)) gpuClass = 'software'
        else if (renderer) gpuClass = 'hardware'
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }

      return {
        nodes,
        links,
        visibleNodes: app.canvas.visible_nodes.length,
        renderer,
        canvasInfoEnabled,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        frontendVersion: window.__COMFYUI_FRONTEND_VERSION__,
        frontendCommit: window.__COMFYUI_FRONTEND_COMMIT__,
        buildMode: window.__COMFYUI_BUILD_MODE__,
        gpuClass
      }
    })
    const activity = await this.page.evaluate(() => {
      const value = (window as unknown as Record<string, unknown>)
        .__perfActivityIdentity
      return (value ?? {}) as Partial<PerfActivityIdentity>
    })
    return buildPerfWorkloadIdentity({ ...source, browserVersion }, activity)
  }
}
