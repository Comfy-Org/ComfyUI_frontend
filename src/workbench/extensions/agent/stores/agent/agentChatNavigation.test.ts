import { describe, expect, it } from 'vitest'

import { reduceChatNavigation } from './agentChatNavigation'
import type { AgentPanelView } from './agentChatNavigation'

const chat: AgentPanelView = { screen: 'chat' }
const idle: AgentPanelView = {
  screen: 'history',
  previousThreadId: 'previous',
  selection: { status: 'idle' }
}
const loading: AgentPanelView = {
  screen: 'history',
  previousThreadId: 'previous',
  selection: { status: 'loading', id: 'target' }
}
const failed: AgentPanelView = {
  screen: 'history',
  previousThreadId: 'previous',
  selection: { status: 'failed', id: 'target' }
}

describe('reduceChatNavigation', () => {
  it.for([chat, idle, loading, failed])(
    'opens the list from $screen, remembering the current thread',
    (view) => {
      expect(
        reduceChatNavigation(view, { type: 'listOpened', threadId: 'now' })
      ).toEqual({
        screen: 'history',
        previousThreadId: 'now',
        selection: { status: 'idle' }
      })
    }
  )

  it('starts loading a chat picked while the conversation is showing', () => {
    expect(
      reduceChatNavigation(chat, {
        type: 'chatSelected',
        id: 'target',
        threadId: 'now'
      })
    ).toEqual({
      screen: 'history',
      previousThreadId: 'now',
      selection: { status: 'loading', id: 'target' }
    })
  })

  it.for([idle, loading, failed])(
    'keeps the remembered thread when a chat is picked from the list',
    (view) => {
      expect(
        reduceChatNavigation(view, {
          type: 'chatSelected',
          id: 'other',
          threadId: 'now'
        })
      ).toEqual({
        screen: 'history',
        previousThreadId: 'previous',
        selection: { status: 'loading', id: 'other' }
      })
    }
  )

  it('shows the conversation once the picked chat has opened', () => {
    expect(
      reduceChatNavigation(loading, { type: 'selectionResolved', opened: true })
    ).toEqual(chat)
  })

  it('marks the picked chat as failed when it could not open', () => {
    expect(
      reduceChatNavigation(loading, {
        type: 'selectionResolved',
        opened: false
      })
    ).toEqual(failed)
  })

  it.for([chat, idle, failed])(
    'ignores a resolution when nothing is loading',
    (view) => {
      expect(
        reduceChatNavigation(view, { type: 'selectionResolved', opened: true })
      ).toBe(view)
    }
  )

  it('turns an interrupted load into a failure and leaves other states alone', () => {
    expect(
      reduceChatNavigation(loading, { type: 'selectionInterrupted' })
    ).toEqual(failed)
    for (const view of [chat, idle, failed])
      expect(reduceChatNavigation(view, { type: 'selectionInterrupted' })).toBe(
        view
      )
  })

  it('forgets a deleted chat that was remembered or being opened', () => {
    expect(
      reduceChatNavigation(loading, { type: 'chatDeleted', id: 'previous' })
    ).toEqual({
      screen: 'history',
      previousThreadId: null,
      selection: { status: 'idle' }
    })
    expect(
      reduceChatNavigation(failed, { type: 'chatDeleted', id: 'target' })
    ).toEqual(idle)
  })

  it.for([chat, idle, loading, failed])(
    'leaves $screen alone when an unrelated chat is deleted',
    (view) => {
      expect(
        reduceChatNavigation(view, { type: 'chatDeleted', id: 'unrelated' })
      ).toBe(view)
    }
  )

  it.for([idle, loading, failed])(
    'returns to the conversation when it is shown',
    (view) => {
      expect(reduceChatNavigation(view, { type: 'conversationShown' })).toEqual(
        chat
      )
    }
  )
})
