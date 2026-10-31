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

  it('ends only the named send when two sends hold one gate', () => {
    let threadId = 'thread-1'
    const gates = useAgentSendGates(() => threadId)

    gates.hold('consent', 'client-message-1')
    threadId = 'thread-2'
    gates.hold('consent', 'client-message-2')
    trackAgentSendGated.mockClear()
    gates.end(
      { gate: 'consent', outcome: 'released', reason: 'accepted' },
      'client-message-2'
    )
    gates.end({ gate: 'consent', outcome: 'dropped', reason: 'panel_closed' })

    expect(
      trackAgentSendGated.mock.calls.map(([metadata]) => [
        metadata.client_message_id,
        metadata.outcome,
        metadata.thread_id
      ])
    ).toEqual([
      ['client-message-2', 'released', 'thread-2'],
      ['client-message-1', 'dropped', 'thread-1']
    ])
  })
})
