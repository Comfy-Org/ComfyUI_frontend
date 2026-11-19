import { beforeEach, describe, expect, it } from 'vitest'

import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  pinShowsWhenHidden,
  useAgentCanvasPinStore
} from './agentCanvasPinStore'
import { useAgentConversationStore } from './agentConversationStore'

const TURN = toTurnId('m-1')

function pinOnLoadedThread() {
  const conversation = useAgentConversationStore()
  conversation.setThreadId('th-1')
  const pins = useAgentCanvasPinStore()
  pins.add({
    threadId: 'th-1',
    turnId: TURN,
    nodeIds: ['7'],
    workflowPath: 'workflows/current.json'
  })
  return { conversation, pins, pin: () => pins.pins[0] }
}

describe('useAgentCanvasPinStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows working while the turn runs, then a new answer until seen', () => {
    const { conversation, pins, pin } = pinOnLoadedThread()
    conversation.startTurn(TURN)
    expect(pins.statusOf(pin())).toBe('working')

    conversation.settleTurn({ threadId: 'th-1', messageId: TURN }, [
      { type: 'text', text: 'It samples the latent.', state: 'done' }
    ])
    expect(pins.statusOf(pin())).toBe('done')

    pins.markSeen(pin().id)
    expect(pins.statusOf(pin())).toBe('seen')
  })

  it('shows failed when the turn ends with an error', () => {
    const { conversation, pins, pin } = pinOnLoadedThread()
    conversation.startTurn(TURN)

    conversation.settleTurn(
      { threadId: 'th-1', messageId: TURN },
      [{ type: 'notice', level: 'error', text: 'The agent stopped.' }],
      'failed'
    )

    expect(pins.statusOf(pin())).toBe('failed')
  })

  it('keeps the last outcome once another chat is loaded', async () => {
    const { conversation, pins, pin } = pinOnLoadedThread()
    conversation.startTurn(TURN)
    conversation.settleTurn(
      { threadId: 'th-1', messageId: TURN },
      [{ type: 'notice', level: 'error', text: 'The agent stopped.' }],
      'failed'
    )
    await Promise.resolve()

    conversation.setThreadId('th-2')
    conversation.hydrate([])

    expect(pins.statusOf(pin())).toBe('failed')
  })

  it('keeps only news on the canvas while pins are hidden', () => {
    expect(
      (['working', 'waiting', 'done', 'failed', 'seen'] as const).filter(
        pinShowsWhenHidden
      )
    ).toEqual(['waiting', 'done', 'failed'])
  })

  it('keeps working when the panel stops following a turn before it answers', () => {
    const { conversation, pins, pin } = pinOnLoadedThread()
    conversation.startTurn(TURN)

    conversation.abortActiveTurn()

    expect(pins.statusOf(pin())).toBe('working')
  })
})
