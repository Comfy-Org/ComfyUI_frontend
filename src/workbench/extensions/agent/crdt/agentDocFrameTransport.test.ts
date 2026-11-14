import { describe, expect, it, vi } from 'vitest'

import { createFakeAgentSocket } from './__fixtures__/agentSocket'

function received(
  transport: ReturnType<typeof createFakeAgentSocket>['transport'],
  type: string
): unknown[] {
  const details: unknown[] = []
  transport.addEventListener(type, (event) => {
    if (event instanceof CustomEvent) details.push(event.detail)
  })
  return details
}

describe('createAgentDocFrameTransport', () => {
  it.for([
    'doc_update',
    'doc_subscribed',
    'doc_ops_result',
    'doc_reset',
    'doc_reseed_result',
    'awareness'
  ])('surfaces an inbound %s as an event carrying its data', (type) => {
    const fake = createFakeAgentSocket()
    const details = received(fake.transport, type)

    fake.receive(type, { workflow_id: 'wf-1', seq: 2 })

    expect(details).toEqual([{ workflow_id: 'wf-1', seq: 2 }])
  })

  it('does not surface chat frames to doc listeners', () => {
    const fake = createFakeAgentSocket()
    const details = received(fake.transport, 'agent_message_delta')

    fake.receive('agent_message_delta', { delta: 'hi' })

    expect(details).toEqual([])
  })

  it('reports every shared socket status edge', () => {
    const fake = createFakeAgentSocket()
    const status = vi.fn()
    fake.transport.onSocketStatus(status)

    fake.open()
    fake.drop()
    fake.open()

    expect(status.mock.calls).toEqual([[false], [true], [false], [true]])
  })

  it('stops listening once destroyed', () => {
    const fake = createFakeAgentSocket()
    fake.transport.addEventListener('doc_update', vi.fn())
    expect(fake.listenerCount()).toBe(1)

    fake.transport.destroy()

    expect(fake.listenerCount()).toBe(0)
  })
})
