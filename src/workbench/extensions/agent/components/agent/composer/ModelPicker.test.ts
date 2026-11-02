import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { api } from '@/scripts/api'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentModelStore } from '@/workbench/extensions/agent/stores/agent/agentModelStore'

import ModelPicker from './ModelPicker.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/workbench/extensions/agent/services/agent/agentAuth'))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const MODELS = {
  models: [
    {
      id: 'cloud:claude-opus-4-8',
      label: 'Claude Opus 4.8 (Comfy Cloud)',
      route: 'cloud',
      available: false,
      reason: 'not_signed_in'
    },
    {
      id: 'local',
      label: 'qwen (this computer)',
      route: 'local',
      available: true,
      reason: null
    },
    {
      id: 'openrouter:qwen/qwen3.8-27b',
      label: 'qwen (OpenRouter)',
      route: 'openrouter',
      available: true,
      reason: null
    }
  ],
  default: 'local'
}

function mount() {
  const view = render(ModelPicker, { global: { plugins: [i18n] } })
  onTestFinished(async () => {
    view.unmount()
    await nextTick()
  })
  return view
}

describe('ModelPicker', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.fetchApi).mockReset()
    vi.mocked(api.fetchApi).mockResolvedValue(jsonResponse(200, MODELS))
  })

  it('renders nothing on a host without the model list', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      jsonResponse(404, { error: 'not found' })
    )
    await useAgentModelStore().load()
    mount()

    expect(screen.queryByTestId('agent-model-picker')).toBeNull()
  })

  it('lists only the available models and records the pick for the chat', async () => {
    useAgentConversationStore().setThreadId('t1')
    await useAgentModelStore().load()
    mount()

    const trigger = await screen.findByTestId('agent-model-picker')
    expect(trigger).toHaveTextContent('qwen (this computer)')

    await userEvent.click(trigger)
    const options = await screen.findAllByRole('menuitemradio')
    expect(options.map((option) => option.textContent.trim())).toEqual([
      'qwen (this computer)',
      'qwen (OpenRouter)'
    ])
    expect(screen.queryByText('Claude Opus 4.8 (Comfy Cloud)')).toBeNull()

    await userEvent.click(
      screen.getByRole('menuitemradio', { name: /qwen \(OpenRouter\)/ })
    )

    expect(useAgentModelStore().modelForSend('t1')).toBe(
      'openrouter:qwen/qwen3.8-27b'
    )
    expect(await screen.findByTestId('agent-model-picker')).toHaveTextContent(
      'qwen (OpenRouter)'
    )
  })

  it('refreshes the list when opened', async () => {
    await useAgentModelStore().load()
    mount()
    vi.mocked(api.fetchApi).mockClear()

    await userEvent.click(await screen.findByTestId('agent-model-picker'))

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/agent/models',
      expect.objectContaining({ method: 'GET' })
    )
  })
})
