import { describe, expect, it } from 'vitest'

import type { ChatHistorySearchState } from './chatHistorySearchState'
import {
  initialChatHistorySearchState,
  transitionChatHistorySearch
} from './chatHistorySearchState'

const searching = (text: string): ChatHistorySearchState => ({
  status: 'searching',
  text
})

describe('chat history search transitions', () => {
  it('searches on non-empty text and returns to idle when it is cleared', () => {
    const typed = transitionChatHistorySearch(initialChatHistorySearchState, {
      type: 'type',
      text: 'plan'
    })
    const cleared = transitionChatHistorySearch(typed.state, { type: 'clear' })

    expect(typed.state).toEqual(searching('plan'))
    expect(cleared.state).toEqual(initialChatHistorySearchState)
  })

  it('keeps whitespace-only text in the field but treats it as idle', () => {
    const { state } = transitionChatHistorySearch(searching('plan'), {
      type: 'type',
      text: '   '
    })

    expect(state).toEqual({ status: 'idle', text: '   ' })
  })

  it('clears non-empty text on Esc and stays in History', () => {
    expect(
      transitionChatHistorySearch(searching('a'), { type: 'escape' })
    ).toEqual({ state: initialChatHistorySearchState, effect: 'none' })
  })

  it('clears whitespace-only text on Esc before leaving History', () => {
    const idleWithSpaces: ChatHistorySearchState = {
      status: 'idle',
      text: '  '
    }

    expect(
      transitionChatHistorySearch(idleWithSpaces, { type: 'escape' })
    ).toEqual({ state: initialChatHistorySearchState, effect: 'none' })
  })

  it('leaves History on Esc when the field is empty', () => {
    expect(
      transitionChatHistorySearch(initialChatHistorySearchState, {
        type: 'escape'
      })
    ).toEqual({
      state: initialChatHistorySearchState,
      effect: 'leaveHistory'
    })
  })
})
