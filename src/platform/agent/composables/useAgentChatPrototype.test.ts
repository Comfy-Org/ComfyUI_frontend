import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentChatPrototype } from './useAgentChatPrototype'

describe('useAgentChatPrototype', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAgentChatPrototype().startNewChat()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts empty', () => {
    const { messages, isEmpty } = useAgentChatPrototype()
    expect(messages.value).toHaveLength(0)
    expect(isEmpty.value).toBe(true)
  })

  it('appends a user message and clears the input on send', () => {
    const { messages, input, send, isEmpty } = useAgentChatPrototype()

    input.value = 'make a duck'
    send()

    expect(messages.value).toHaveLength(1)
    expect(messages.value[0]).toMatchObject({
      role: 'user',
      text: 'make a duck'
    })
    expect(input.value).toBe('')
    expect(isEmpty.value).toBe(false)
  })

  it('streams a mocked assistant reply after sending', () => {
    const { messages, send, status } = useAgentChatPrototype()

    send('make a duck')
    expect(status.value).toBe('submitted')

    vi.advanceTimersByTime(10_000)

    expect(status.value).toBe('ready')
    expect(messages.value).toHaveLength(2)
    const reply = messages.value[1]
    expect(reply.role).toBe('assistant')
    expect(reply.text).toContain('make a duck')
  })

  it('ignores send while a reply is in progress', () => {
    const { messages, send } = useAgentChatPrototype()

    send('first')
    send('second')

    expect(messages.value).toHaveLength(1)
    expect(messages.value[0].text).toBe('first')
  })

  it('applies a suggestion to the input', () => {
    const { input, applySuggestion } = useAgentChatPrototype()

    applySuggestion('List my saved workflows')

    expect(input.value).toBe('List my saved workflows')
  })

  it('marks a confirmation rejected without triggering a reply', () => {
    const { messages, loadConversation, respondToConfirmation } =
      useAgentChatPrototype()

    loadConversation('demo-code-block')
    const confirmationMessage = messages.value.find((m) => m.confirmation)!

    respondToConfirmation(confirmationMessage.id, false)

    expect(confirmationMessage.confirmation).toMatchObject({
      status: 'rejected'
    })
    vi.advanceTimersByTime(10_000)
    expect(messages.value).toHaveLength(3)
  })

  it('simulates the agent processing after a confirmation is approved', () => {
    const { messages, status, loadConversation, respondToConfirmation } =
      useAgentChatPrototype()

    loadConversation('demo-code-block')
    const confirmationMessage = messages.value.find((m) => m.confirmation)!

    respondToConfirmation(confirmationMessage.id, true)

    expect(confirmationMessage.confirmation).toMatchObject({
      status: 'approved'
    })
    expect(status.value).toBe('submitted')

    vi.advanceTimersByTime(10_000)

    expect(status.value).toBe('ready')
    expect(messages.value).toHaveLength(4)
    expect(messages.value.at(-1)?.text).toContain('ran successfully')
  })

  it('clears the conversation on startNewChat', () => {
    const { messages, send, startNewChat, isEmpty } = useAgentChatPrototype()

    send('make a duck')
    vi.advanceTimersByTime(10_000)
    expect(messages.value.length).toBeGreaterThan(0)

    startNewChat()

    expect(messages.value).toHaveLength(0)
    expect(isEmpty.value).toBe(true)
  })
})
