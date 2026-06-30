import { computed, readonly, ref } from 'vue'

import type { ChatStatus } from '@/components/ai-elements/prompt-input/types'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const STREAM_INTERVAL_MS = 40
const THINKING_DELAY_MS = 500

const messages = ref<AgentMessage[]>([])
const input = ref('')
const status = ref<ChatStatus>('ready')

let idCounter = 0
let streamTimer: ReturnType<typeof setInterval> | null = null
let thinkingTimer: ReturnType<typeof setTimeout> | null = null

function nextId() {
  idCounter += 1
  return `agent-msg-${idCounter}`
}

function buildMockReply(prompt: string) {
  return [
    `Sure — here is a mocked plan for **${prompt}**:`,
    '',
    '1. Inspect the current graph and selected nodes.',
    '2. Assemble the nodes needed for the request.',
    '3. Wire the connections and set sensible defaults.',
    '',
    '_This is a prototype response and does not modify your graph._'
  ].join('\n')
}

function clearTimers() {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
  if (thinkingTimer) {
    clearTimeout(thinkingTimer)
    thinkingTimer = null
  }
}

function streamReply(reply: string) {
  messages.value.push({ id: nextId(), role: 'assistant', text: '' })
  const message = messages.value[messages.value.length - 1]
  status.value = 'streaming'

  const tokens = reply.split(' ')
  let index = 0
  streamTimer = setInterval(() => {
    if (index >= tokens.length) {
      clearTimers()
      status.value = 'ready'
      return
    }
    message.text += (index === 0 ? '' : ' ') + tokens[index]
    index += 1
  }, STREAM_INTERVAL_MS)
}

function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || status.value !== 'ready') return

  messages.value.push({ id: nextId(), role: 'user', text: content })
  input.value = ''
  status.value = 'submitted'

  thinkingTimer = setTimeout(() => {
    thinkingTimer = null
    streamReply(buildMockReply(content))
  }, THINKING_DELAY_MS)
}

function stop() {
  clearTimers()
  status.value = 'ready'
}

function applySuggestion(text: string) {
  input.value = text
}

function startNewChat() {
  clearTimers()
  messages.value = []
  input.value = ''
  status.value = 'ready'
}

export function useAgentChatPrototype() {
  return {
    messages: readonly(messages),
    input,
    status: readonly(status),
    isEmpty: computed(() => messages.value.length === 0),
    send,
    stop,
    applySuggestion,
    startNewChat
  }
}
