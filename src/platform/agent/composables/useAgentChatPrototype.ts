import { computed, readonly, ref } from 'vue'

import type { ChatStatus } from '@/components/ai-elements/prompt-input/types'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export interface AgentConversation {
  id: string
  title: string
  createdAt: Date
}

const STREAM_INTERVAL_MS = 40
const THINKING_DELAY_MS = 500

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

const messages = ref<AgentMessage[]>([])
const input = ref('')
const status = ref<ChatStatus>('ready')
const chatHistory = ref<AgentConversation[]>([
  {
    id: 'h-1',
    title: 'Generate a yellow duck with a hockey mask',
    createdAt: daysAgo(0)
  },
  {
    id: 'h-2',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(0)
  },
  {
    id: 'h-3',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(0)
  },
  {
    id: 'h-4',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(1)
  },
  {
    id: 'h-5',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(1)
  },
  {
    id: 'h-6',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(1)
  },
  {
    id: 'h-7',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(5)
  },
  {
    id: 'h-8',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(15)
  }
])

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
  const firstUserMessage = messages.value.find((m) => m.role === 'user')
  if (firstUserMessage) {
    chatHistory.value.unshift({
      id: `h-${Date.now()}`,
      title: firstUserMessage.text,
      createdAt: new Date()
    })
  }
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
    chatHistory: readonly(chatHistory),
    isEmpty: computed(() => messages.value.length === 0),
    send,
    stop,
    applySuggestion,
    startNewChat
  }
}
