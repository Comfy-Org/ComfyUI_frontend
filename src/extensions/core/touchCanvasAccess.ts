import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'

const reportedEntryPoints = new Set<string>()

function reportMissingCanvas(entryPoint: string, e: Event) {
  if (reportedEntryPoints.has(entryPoint)) return
  reportedEntryPoints.add(entryPoint)

  const canvasEl = app.canvasElRef.value
  const pointer = e instanceof PointerEvent ? e : undefined
  reportError(new Error('Canvas unavailable while handling touch input'), {
    errorType: 'error_handling_touch_input_missing_canvas',
    surface: 'graph',
    level: 'warning',
    tags: { feature_area: 'extensions', operation: entryPoint },
    context: {
      entryPoint,
      eventType: e.type,
      pointerType: pointer?.pointerType,
      isPrimary: pointer?.isPrimary,
      documentReadyState: document.readyState,
      bootstrapOutcome: bootstrapTracer.outcome,
      hasWindowApp: window.app !== undefined,
      hasCanvasEl: canvasEl !== undefined,
      canvasElConnected: canvasEl?.isConnected,
      targetIsCanvasEl: canvasEl !== undefined && e.target === canvasEl
    }
  })
}

export function canvasOrReport(entryPoint: string, e: Event) {
  const canvas = app.canvasOrUndefined
  if (!canvas) reportMissingCanvas(entryPoint, e)
  return canvas
}
