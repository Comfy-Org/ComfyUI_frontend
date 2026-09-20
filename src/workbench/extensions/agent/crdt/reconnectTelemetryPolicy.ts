const WINDOW_MS = 60_000
const STORM_THRESHOLD = 3

export interface ReconnectTelemetryState {
  reconnects: number[]
  stormReported: boolean
  lastAbnormalCloseReportAt: number | null
}

export type ReconnectTelemetryEvent =
  | { type: 'reset' }
  | { type: 'closed'; code: number; now: number }
  | { type: 'reconnecting'; now: number }

export interface ReconnectTelemetryTransition {
  state: ReconnectTelemetryState
  report: 'abnormal_close' | 'reconnect_storm' | null
}

export const initialReconnectTelemetryState = (): ReconnectTelemetryState => ({
  reconnects: [],
  stormReported: false,
  lastAbnormalCloseReportAt: null
})

/** Bounds lifecycle telemetry to one close per window and one report per storm. */
export function transitionReconnectTelemetry(
  state: ReconnectTelemetryState,
  event: ReconnectTelemetryEvent
): ReconnectTelemetryTransition {
  if (event.type === 'reset')
    return { state: initialReconnectTelemetryState(), report: null }

  if (event.type === 'closed') {
    if (
      event.code !== 1006 ||
      (state.lastAbnormalCloseReportAt !== null &&
        event.now - state.lastAbnormalCloseReportAt <= WINDOW_MS)
    )
      return { state, report: null }
    return {
      state: { ...state, lastAbnormalCloseReportAt: event.now },
      report: 'abnormal_close'
    }
  }

  const reconnects = state.reconnects.filter(
    (at) => event.now - at <= WINDOW_MS
  )
  const stormReported = reconnects.length === 0 ? false : state.stormReported
  reconnects.push(event.now)
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
