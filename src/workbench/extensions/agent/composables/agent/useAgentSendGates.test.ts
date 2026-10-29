import { useTelemetry } from '@comfyorg/telemetry'
import { assert, describe, expect, it, vi } from 'vitest'

import { useAgentSendGates } from './useAgentSendGates'

vi.mock(import('@comfyorg/telemetry'))
const telemetryProvider = useTelemetry()
assert.exists(telemetryProvider)
const trackAgentSendGated = vi.mocked(telemetryProvider.trackAgentSendGated)

describe('useAgentSendGates', () => {
  it('reports only the first end of a hold', () => {
    const gates = useAgentSendGates(() => 'thread-1')

    gates.hold('coach', 'client-message-1')
    gates.end({ gate: 'coach', outcome: 'released', reason: 'finished' })
    gates.end({ gate: 'coach', outcome: 'dropped', reason: 'panel_closed' })

    expect(
      trackAgentSendGated.mock.calls.map(([metadata]) => metadata.outcome)
    ).toEqual(['held', 'released'])
  })

  it('reports nothing for an end with no hold on that gate', () => {
    const gates = useAgentSendGates(() => null)

    gates.hold('consent', 'client-message-1')
    trackAgentSendGated.mockClear()
    gates.end({ gate: 'coach', outcome: 'dropped', reason: 'panel_closed' })

    expect(trackAgentSendGated).not.toHaveBeenCalled()
  })
})
