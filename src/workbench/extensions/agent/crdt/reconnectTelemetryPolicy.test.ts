import { describe, expect, it } from 'vitest'

import {
  initialReconnectTelemetryState,
  transitionReconnectTelemetry
} from './reconnectTelemetryPolicy'

describe('reconnectTelemetryPolicy', () => {
  it('reports only abnormal 1006 closes and cools down after the window', () => {
    const state = initialReconnectTelemetryState()

    const normal = transitionReconnectTelemetry(state, {
      type: 'closed',
      code: 1000,
      now: 1
    })
    expect(normal.report).toBeNull()

    const first = transitionReconnectTelemetry(normal.state, {
      type: 'closed',
      code: 1006,
      now: 10
    })
    expect(first.report).toBe('abnormal_close')

    const boundary = transitionReconnectTelemetry(first.state, {
      type: 'closed',
      code: 1006,
      now: 60_010
    })
    expect(boundary.report).toBeNull()

    const cooledDown = transitionReconnectTelemetry(boundary.state, {
      type: 'closed',
      code: 1006,
      now: 60_011
    })
    expect(cooledDown.report).toBe('abnormal_close')
  })

  it('reports once per three-reconnect storm and re-arms after a quiet window', () => {
    let state = initialReconnectTelemetryState()
    function reconnect(now: number) {
      const transition = transitionReconnectTelemetry(state, {
        type: 'reconnecting',
        now
      })
      state = transition.state
      return transition.report
    }

    expect(reconnect(0)).toBeNull()
    expect(reconnect(10)).toBeNull()
    expect(reconnect(20)).toBe('reconnect_storm')
    expect(reconnect(30)).toBeNull()

    expect(reconnect(60_031)).toBeNull()
    expect(reconnect(60_032)).toBeNull()
    expect(reconnect(60_033)).toBe('reconnect_storm')
  })
})
