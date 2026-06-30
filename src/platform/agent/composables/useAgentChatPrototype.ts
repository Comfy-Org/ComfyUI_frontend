import { computed, readonly, ref } from 'vue'

import type { ChatStatus } from '@/components/ai-elements/prompt-input/types'

export interface ToolCall {
  name: string
  status: 'success' | 'error'
  durationMs: number
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  thinking?: boolean
  toolCalls?: readonly ToolCall[]
}

export interface AgentConversation {
  id: string
  title: string
  createdAt: Date
  messages: readonly AgentMessage[]
}

const STREAM_INTERVAL_MS = 40
const THINKING_DELAY_MS = 500
const TOOL_CALLS_DELAY_MS = 1200

const MOCK_TOOL_CALLS: ToolCall[] = [
  { name: 'Opening template', status: 'success', durationMs: 200 },
  { name: 'New workflow', status: 'success', durationMs: 1300 },
  { name: 'Set node widget', status: 'error', durationMs: 1200 },
  { name: 'Pointing to node', status: 'success', durationMs: 1100 },
  { name: 'Set node widget', status: 'error', durationMs: 200 }
]

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

const messages = ref<AgentMessage[]>([])
const input = ref('')
const status = ref<ChatStatus>('ready')
const currentConversationId = ref<string | null>(null)
const chatHistory = ref<AgentConversation[]>([
  {
    id: 'h-1',
    title: 'Generate a yellow duck with a hockey mask',
    createdAt: daysAgo(0),
    messages: []
  },
  {
    id: 'h-2',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(0),
    messages: []
  },
  {
    id: 'h-3',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(0),
    messages: []
  },
  {
    id: 'h-4',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(1),
    messages: []
  },
  {
    id: 'h-5',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(1),
    messages: []
  },
  {
    id: 'h-6',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(1),
    messages: []
  },
  {
    id: 'h-7',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(5),
    messages: []
  },
  {
    id: 'h-8',
    title: 'Build me a workflow for image to video with 3 models',
    createdAt: daysAgo(15),
    messages: []
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
  messages.value.push({
    id: nextId(),
    role: 'assistant',
    text: '',
    thinking: true,
    toolCalls: undefined
  })
  const message = messages.value[messages.value.length - 1]

  thinkingTimer = setTimeout(() => {
    thinkingTimer = null
    message.thinking = false
    message.toolCalls = MOCK_TOOL_CALLS
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
  }, TOOL_CALLS_DELAY_MS)
}

function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || status.value !== 'ready') return

  messages.value.push({ id: nextId(), role: 'user', text: content })
  input.value = ''
  status.value = 'submitted'

  if (!currentConversationId.value) {
    const id = `conv-${Date.now()}`
    currentConversationId.value = id
    chatHistory.value.unshift({
      id,
      title: content,
      createdAt: new Date(),
      messages: messages.value
    })
  }

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
  currentConversationId.value = null
}

function deleteConversation(id: string) {
  const idx = chatHistory.value.findIndex((c) => c.id === id)
  if (idx !== -1) chatHistory.value.splice(idx, 1)
  if (currentConversationId.value === id) startNewChat()
}

async function copyConversation(id: string) {
  const conv = chatHistory.value.find((c) => c.id === id)
  if (!conv) return
  const lines =
    conv.messages.length > 0
      ? conv.messages.map(
          (m) => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.text}`
        )
      : [conv.title]
  await navigator.clipboard.writeText(lines.join('\n\n'))
}

export function useAgentChatPrototype() {
  return {
    messages: readonly(messages),
    input,
    status: readonly(status),
    chatHistory: readonly(chatHistory),
    currentConversationId: readonly(currentConversationId),
    isEmpty: computed(() => messages.value.length === 0),
    send,
    stop,
    applySuggestion,
    startNewChat,
    deleteConversation,
    copyConversation
  }
}
