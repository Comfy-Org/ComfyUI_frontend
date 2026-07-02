import { computed, readonly, ref } from 'vue'

import type { ChatStatus } from '@/components/ai-elements/prompt-input/types'

export interface ToolCall {
  name: string
  status: 'success' | 'error'
  durationMs: number
}

export interface MessageAttachment {
  name: string
  type: string
  url: string
  size: number
}

interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachments?: readonly MessageAttachment[]
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

const FENCE = '```'

const DEMO_CONVERSATIONS: AgentConversation[] = [
  {
    id: 'demo-code-block',
    title: 'Code block',
    createdAt: daysAgo(0),
    messages: [
      { id: 'demo-code-1', role: 'user', text: 'Show me a workflow as code' },
      {
        id: 'demo-code-2',
        role: 'assistant',
        text: `${FENCE}javascript:workflow.js
export default {
  nodes: [
    { id: 1, type: "CheckpointLoaderSimple", inputs: { ckpt_name: "flux1-dev-fp8.safetensors" } },
    { id: 2, type: "CLIPTextEncode", inputs: { text: "a golden hour sunset over mountains" } },
    { id: 3, type: "KSampler", inputs: { seed: 42, steps: 20, cfg: 7, sampler_name: "euler" } },
    { id: 4, type: "VAEDecode" },
    { id: 5, type: "SaveImage", inputs: { filename_prefix: "output" } },
  ],
  links: [
    [1, 0, 3, 0], // model → KSampler
    [2, 0, 3, 1], // conditioning → KSampler
    [3, 0, 4, 0], // latent → VAEDecode
    [4, 0, 5, 0], // image → SaveImage
  ],
}
${FENCE}`
      }
    ]
  },
  {
    id: 'demo-markdown',
    title: 'Markdown',
    createdAt: daysAgo(0),
    messages: [
      {
        id: 'demo-md-1',
        role: 'user',
        text: 'Explain how to build a basic workflow'
      },
      {
        id: 'demo-md-2',
        role: 'assistant',
        text: `# Workflow Overview

This guide explains how to **build a basic image generation workflow** in ComfyUI.

## Key Concepts

- **Nodes** are the building blocks — each one performs a single operation
- **Edges** carry data between nodes
- Use _italics_ for emphasis and \`inline code\` for node names

## Steps

1. Load a checkpoint with \`CheckpointLoaderSimple\`
2. Add \`CLIPTextEncode\` and write your prompt
3. Connect both to \`KSampler\` to run diffusion
4. Decode the result with \`VAEDecode\`
5. Save the image with \`SaveImage\`

> Start with a simple 4-node chain and expand from there.

See the full reference at [docs.comfy.org](https://docs.comfy.org).`
      }
    ]
  },
  {
    id: 'demo-table',
    title: 'Table',
    createdAt: daysAgo(0),
    messages: [
      {
        id: 'demo-table-1',
        role: 'user',
        text: 'Compare the available samplers'
      },
      {
        id: 'demo-table-2',
        role: 'assistant',
        text: `Here is a comparison of common samplers:

| Sampler | Steps | Quality | Speed |
| --- | --- | --- | --- |
| euler | 20 | Good | Fast |
| euler_a | 20 | Great | Fast |
| dpm++ 2m | 25 | Excellent | Medium |
| dpm++ sde | 30 | Best | Slow |
| ddim | 50 | Good | Slow |

Use **euler** or **euler_a** to get started quickly.`
      }
    ]
  },
  {
    id: 'demo-thinking',
    title: 'Thinking',
    createdAt: daysAgo(0),
    messages: [
      { id: 'demo-think-1', role: 'user', text: 'Analyze my current workflow' },
      { id: 'demo-think-2', role: 'assistant', text: '', thinking: true }
    ]
  },
  {
    id: 'demo-tool-calls',
    title: 'Tool calls',
    createdAt: daysAgo(0),
    messages: [
      {
        id: 'demo-tools-1',
        role: 'user',
        text: 'Build a workflow for image to video'
      },
      {
        id: 'demo-tools-2',
        role: 'assistant',
        text: 'I set up the nodes and connections for your image-to-video workflow. The KSampler is configured with sensible defaults — adjust the steps and CFG scale to taste.',
        toolCalls: MOCK_TOOL_CALLS
      }
    ]
  },
  {
    id: 'demo-attachments',
    title: 'Attachments',
    createdAt: daysAgo(0),
    messages: [
      {
        id: 'demo-attach-1',
        role: 'user',
        text: 'Use this image as a reference',
        attachments: [
          {
            name: 'reference.png',
            type: 'image/png',
            url: '/assets/images/reference.png',
            size: 204800
          },
          {
            name: 'style-guide.pdf',
            type: 'application/pdf',
            url: '',
            size: 512000
          }
        ]
      },
      {
        id: 'demo-attach-2',
        role: 'assistant',
        text: "I can see the reference image. I'll use the visual style and color palette as a guide when configuring the workflow nodes."
      }
    ]
  }
]

const messages = ref<AgentMessage[]>([])
const input = ref('')
const status = ref<ChatStatus>('ready')
const currentConversationId = ref<string | null>(null)
const chatHistory = ref<AgentConversation[]>([
  ...DEMO_CONVERSATIONS,
  {
    id: 'h-yesterday',
    title: 'Generate a yellow duck with a hockey mask',
    createdAt: daysAgo(1),
    messages: [
      {
        id: 'h-y-1',
        role: 'user',
        text: 'Generate a yellow duck with a hockey mask'
      },
      {
        id: 'h-y-2',
        role: 'assistant',
        text: buildMockReply('Generate a yellow duck with a hockey mask'),
        toolCalls: MOCK_TOOL_CALLS
      }
    ]
  },
  {
    id: 'h-last7',
    title: 'Build a workflow for image to video with 3 models',
    createdAt: daysAgo(4),
    messages: [
      {
        id: 'h-l7-1',
        role: 'user',
        text: 'Build a workflow for image to video with 3 models'
      },
      {
        id: 'h-l7-2',
        role: 'assistant',
        text: buildMockReply(
          'Build a workflow for image to video with 3 models'
        ),
        toolCalls: MOCK_TOOL_CALLS
      }
    ]
  },
  {
    id: 'h-last30',
    title: 'Find the best workflow for skin upscaling',
    createdAt: daysAgo(15),
    messages: [
      {
        id: 'h-l30-1',
        role: 'user',
        text: 'Find the best workflow for skin upscaling'
      },
      {
        id: 'h-l30-2',
        role: 'assistant',
        text: buildMockReply('Find the best workflow for skin upscaling'),
        toolCalls: MOCK_TOOL_CALLS
      }
    ]
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
    `# Plan for ${prompt}`,
    '',
    '## Overview',
    '',
    `This is a mocked response for **${prompt}**. It demonstrates the markdown rendering capabilities of the agent chat panel.`,
    '',
    '## Steps',
    '',
    '1. Inspect the current graph and selected nodes.',
    '2. Assemble the nodes needed for the request.',
    '3. Wire the connections and set sensible defaults.',
    '4. Validate the output and iterate as needed.',
    '',
    '## Key Concepts',
    '',
    '- **Nodes** are the building blocks of a workflow.',
    '- **Edges** connect nodes and carry data between them.',
    '- Use _italics_ for emphasis and `inline code` for node names.',
    '',
    '## Before You Start',
    '',
    '> Make sure your checkpoint model is downloaded and placed in the `models/checkpoints` folder. The workflow will not run without it.',
    '',
    '## Node Reference',
    '',
    '| Node | Type | Description |',
    '| --- | --- | --- |',
    '| KSampler | Sampler | Runs the diffusion sampling loop |',
    '| CLIPTextEncode | Conditioning | Encodes a text prompt |',
    '| VAEDecode | Latent | Decodes latent image to pixels |',
    '',
    '## Example Workflow',
    '',
    '```javascript:workflow.js',
    'export default {',
    '  nodes: [',
    '    { id: 1, type: "CheckpointLoaderSimple", inputs: { ckpt_name: "flux1-dev-fp8.safetensors" } },',
    '    { id: 2, type: "CLIPTextEncode", inputs: { text: "a photo of a mountain at sunset" } },',
    '    { id: 3, type: "KSampler", inputs: { seed: 42, steps: 20, cfg: 7, sampler_name: "euler" } },',
    '    { id: 4, type: "VAEDecode" },',
    '    { id: 5, type: "SaveImage", inputs: { filename_prefix: "output" } },',
    '  ],',
    '  links: [',
    '    [1, 0, 3, 0], // model → KSampler',
    '    [2, 0, 3, 1], // conditioning → KSampler',
    '    [3, 0, 4, 0], // latent → VAEDecode',
    '    [4, 0, 5, 0], // image → SaveImage',
    '  ],',
    '}',
    '```',
    '',
    '## Resources',
    '',
    'Download the completed workflow: https://comfyhub.com/workflows/flux-img2img-v2.json',
    '',
    'Or grab the model checkpoint from the registry:',
    'https://comfy.org/models/flux1-dev-fp8.safetensors',
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

function send(text?: string, files: File[] = []) {
  const content = (text ?? input.value).trim()
  if (!content || status.value !== 'ready') return

  const attachments: MessageAttachment[] = files.map((f) => ({
    name: f.name,
    type: f.type,
    url: URL.createObjectURL(f),
    size: f.size
  }))

  messages.value.push({
    id: nextId(),
    role: 'user',
    text: content,
    attachments: attachments.length ? attachments : undefined
  })
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

function loadConversation(id: string) {
  const conv = chatHistory.value.find((c) => c.id === id)
  if (!conv) return
  clearTimers()
  messages.value = conv.messages.map((m) => ({ ...m }))
  currentConversationId.value = id
  status.value = 'ready'
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
    loadConversation,
    deleteConversation,
    copyConversation
  }
}
