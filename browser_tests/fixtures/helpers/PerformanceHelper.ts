import type { CDPSession, Page } from '@playwright/test'

import type { CdpMetricSnapshot } from '@/utils/cdpPerformanceMetrics'
import {
  computeCdpTaskAccounting,
  parseCdpMetrics,
  requireCdpMetric
} from '@/utils/cdpPerformanceMetrics'
import type {
  PerfIdentitySource,
  PerfWorkloadIdentity
} from '@e2e/fixtures/helpers/perfWorkloadIdentity'
import { buildPerfWorkloadIdentity } from '@e2e/fixtures/helpers/perfWorkloadIdentity'
import type {
  RafCollection,
  RafCollectorState
} from '@e2e/fixtures/helpers/rafMetrics'
import {
  getRafRejectionReason,
  summarizeRafIntervals
} from '@e2e/fixtures/helpers/rafMetrics'
import type {
  PerfMeasurement,
  PerfMeasurementResult
} from '@e2e/fixtures/utils/perfReportSchema'

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

const RAF_STATE_KEY = '__perfRafCollectorState'

type MeasurementState =
  | { kind: 'idle' }
  | { kind: 'measuring'; snapshot: PerfSnapshot }

export function getMeasurementRejectionReason(
  rafCollection: RafCollection | null,
  nonMonotonicCdpMetrics: string[]
): string | null {
  if (nonMonotonicCdpMetrics.length) {
    return `non-monotonic CDP metrics: ${nonMonotonicCdpMetrics.join(', ')}`
  }
  return getRafRejectionReason(rafCollection)
}

export class PerformanceHelper {
  private cdp: CDPSession | null = null
  private measurementState: MeasurementState = { kind: 'idle' }

  constructor(private readonly page: Page) {}

  async init(): Promise<void> {
    this.cdp = await this.page.context().newCDPSession(this.page)
    await this.cdp.send('Performance.enable', { timeDomain: 'timeTicks' })
  }

  async dispose(): Promise<void> {
    this.measurementState = { kind: 'idle' }
    try {
      await this.stopRafCollectorIfRunning()
    } catch (error) {
      if (!this.page.isClosed()) throw error
    } finally {
      if (this.cdp) {
        const cdp = this.cdp
        this.cdp = null
        try {
          await cdp.send('Performance.disable')
        } finally {
          await cdp.detach()
        }
      }
    }
  }

  private async getSnapshot(): Promise<PerfSnapshot> {
    if (!this.cdp) throw new Error('PerformanceHelper not initialized')
    const { metrics } = await this.cdp.send('Performance.getMetrics')
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
        const startTimeoutId = setTimeout(resolve, 1_000)
        const state: RafCollectorState = {
          intervalsMs: [],
          lastTimestamp: null,
          requestId: null,
          running: true,
          startVisibility: document.visibilityState,
          visibilityChanged: false,
          onVisibilityChange: () => {
            state.visibilityChanged = true
            clearTimeout(startTimeoutId)
            resolve()
          }
        }
        win[stateKey] = state
        document.addEventListener('visibilitychange', state.onVisibilityChange)

        if (document.visibilityState !== 'visible') {
          clearTimeout(startTimeoutId)
          resolve()
          return
        }

        const tick = (timestamp: number) => {
          if (!state.running) return
          if (state.lastTimestamp !== null) {
            state.intervalsMs.push(timestamp - state.lastTimestamp)
          }
          state.lastTimestamp = timestamp
          state.requestId = requestAnimationFrame(tick)
          clearTimeout(startTimeoutId)
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

      if (state.requestId !== null) cancelAnimationFrame(state.requestId)

      return new Promise<RafCollection>((resolve) => {
        let finished = false
        let finalRequestId: number | null = null
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const finish = (timestamp?: number, boundaryTimedOut = false) => {
          if (finished) return
          finished = true
          if (finalRequestId !== null) cancelAnimationFrame(finalRequestId)
          if (timeoutId !== null) clearTimeout(timeoutId)
          document.removeEventListener(
            'visibilitychange',
            state.onVisibilityChange
          )
          document.removeEventListener('visibilitychange', finishWhenHidden)
          if (timestamp !== undefined && state.lastTimestamp !== null) {
            state.intervalsMs.push(timestamp - state.lastTimestamp)
          }
          state.running = false
          delete win[stateKey]
          resolve({
            intervalsMs: state.intervalsMs,
            startVisibility: state.startVisibility,
            endVisibility: document.visibilityState,
            visibilityChanged: state.visibilityChanged,
            boundaryTimedOut
          })
        }

        const finishWhenHidden = () => {
          state.visibilityChanged = true
          if (document.visibilityState !== 'visible') finish()
        }
        document.addEventListener('visibilitychange', finishWhenHidden)

        if (state.visibilityChanged || document.visibilityState !== 'visible') {
          finish()
          return
        }

        finalRequestId = requestAnimationFrame((timestamp) => finish(timestamp))
        timeoutId = setTimeout(() => finish(undefined, true), 1_000)
      })
    }, RAF_STATE_KEY)
  }

  async startMeasuring(): Promise<void> {
    if (this.measurementState.kind === 'measuring') {
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
    try {
      await this.startRafCollector()
      const snapshot = await this.getSnapshot()
      this.measurementState = { kind: 'measuring', snapshot }
    } catch (error) {
      await Promise.allSettled([this.stopRafCollectorIfRunning()])
      throw error
    }
  }

  async stopMeasuring(name: string): Promise<PerfMeasurementResult> {
    if (this.measurementState.kind === 'idle') {
      throw new Error('Call startMeasuring() first')
    }

    const before = this.measurementState.snapshot
    this.measurementState = { kind: 'idle' }
    let after: PerfSnapshot
    let rafCollection: RafCollection | null
    try {
      after = await this.getSnapshot()
    } finally {
      rafCollection = await this.stopRafCollectorIfRunning()
    }

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
    const measurement: PerfMeasurement = {
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
      workloadIdentity,
      ...summarizeRafIntervals(rafIntervalsMs)
    }
    const rejectionReason = getMeasurementRejectionReason(
      rafCollection,
      taskAccounting.nonMonotonicCdpMetrics
    )
    return rejectionReason
      ? { kind: 'rejected', reason: rejectionReason, measurement }
      : { kind: 'accepted', measurement }
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
        type: node.type,
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
        buildMode: window.__COMFYUI_BUILD_MODE__
      }
    })
    const gpuClass = await this.page.evaluate(() => {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl')
      if (!gl) return 'unknown' as const
      const extension = gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = extension
        ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL))
        : ''
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      if (/swiftshader/i.test(renderer)) return 'swiftshader' as const
      if (/software|llvmpipe/i.test(renderer)) return 'software' as const
      return renderer ? ('hardware' as const) : ('unknown' as const)
    })
    return buildPerfWorkloadIdentity({ ...source, browserVersion, gpuClass })
  }
}
