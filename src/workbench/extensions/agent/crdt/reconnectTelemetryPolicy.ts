export const RECONNECT_TELEMETRY_WINDOW_MS = 60_000
const STORM_THRESHOLD = 3

export interface ReconnectTelemetryState {
  readonly reconnects: readonly number[]
  readonly stormReported: boolean
  readonly lastAbnormalCloseReportAt: number | null
}

export type ReconnectTelemetryEvent =
  | { type: 'closed'; code: number; now: number }
  | { type: 'reconnecting'; now: number }

export interface ReconnectTelemetryTransition {
  state: ReconnectTelemetryState
  report: 'abnormal_close' | 'reconnect_storm' | null
}

export function initialReconnectTelemetryState(): ReconnectTelemetryState {
  return {
    reconnects: [],
    stormReported: false,
    lastAbnormalCloseReportAt: null
  }
}

/** Bounds lifecycle telemetry to one close per window and one report per storm. */
export function transitionReconnectTelemetry(
  state: ReconnectTelemetryState,
  event: ReconnectTelemetryEvent
): ReconnectTelemetryTransition {
  if (event.type === 'closed') {
    if (
      event.code !== 1006 ||
      (state.lastAbnormalCloseReportAt !== null &&
        event.now - state.lastAbnormalCloseReportAt <=
          RECONNECT_TELEMETRY_WINDOW_MS)
    )
      return { state, report: null }
    return {
      state: { ...state, lastAbnormalCloseReportAt: event.now },
      report: 'abnormal_close'
    }
  }

  const reconnectsInWindow = state.reconnects.filter(
    (at) => event.now - at <= RECONNECT_TELEMETRY_WINDOW_MS
  )
  const reconnects = [...reconnectsInWindow, event.now]
  const stormReported =
    reconnectsInWindow.length === 0 ? false : state.stormReported
  const report =
    reconnects.length >= STORM_THRESHOLD && !stormReported
      ? 'reconnect_storm'
      : null
  return {
    state: {
      ...state,
      reconnects,
      stormReported: stormReported || report === 'reconnect_storm'
    },
    report
  }
}
