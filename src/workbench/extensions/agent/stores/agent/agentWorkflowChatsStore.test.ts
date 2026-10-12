import { respondToFetch } from '@comfyorg/test-utils/fetch'
import type {
  AgentThreadListResponse,
  AgentThreadSummary
} from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'
import { api } from '@/scripts/api'

import { useAgentChatHistoryStore } from './agentChatHistoryStore'
import { useAgentPanelStore } from './agentPanelStore'
import { useAgentWorkflowChatsStore } from './agentWorkflowChatsStore'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry'))

const threadsRoute = /\/api\/agent\/threads(\?|$)/

function threadList(...ids: string[]): Response {
  return Response.json({
    threads: ids.map(
      (id): AgentThreadSummary => ({
        created_at: '2026-10-01T10:00:00Z',
        id,
        last_message_at: '2026-10-01T10:00:00Z',
        message_count: 1,
        preview: '',
        status: 'active',
        title: id,
        updated_at: '2026-10-01T10:00:00Z',
        workflow_id: 'wf-1'
      })
    ),
    pagination: { has_more: false, limit: 100, offset: 0, total: ids.length }
  } satisfies AgentThreadListResponse)
}

describe('useAgentWorkflowChatsStore', () => {
  beforeEach(() => {
    vi.mocked(api.fetchApi).mockImplementation((route, options) =>
      fetch(`/api${route}`, options)
    )
    useAgentPanelStore().enabled = true
  })

  it('hands a picked chat to the mounted panel without reopening it', () => {
    const store = useAgentWorkflowChatsStore()
    const opener = vi.fn()
    store.attachPanel(opener)

    store.openChat('workflows/a.json', 'th-1')

    expect(opener).toHaveBeenCalledExactlyOnceWith('workflows/a.json', 'th-1')
    expect(useTelemetry()?.trackAgentPanelOpened).not.toHaveBeenCalled()
  })

  it('opens the closed panel and keeps the request for it to carry out once', () => {
    const store = useAgentWorkflowChatsStore()
    const detach = store.attachPanel(vi.fn())
    detach()

    store.openChat('workflows/a.json', null)

    expect(useAgentPanelStore().isVisible).toBe(true)
    expect(useTelemetry()?.trackAgentPanelOpened).toHaveBeenCalledWith({
      source: 'workflow_chats'
    })
    expect(store.takePendingRequest()).toEqual({
      workflowPath: 'workflows/a.json',
      chatId: null
    })
    expect(store.takePendingRequest()).toBeNull()
  })

  it('drops the request when the panel closes before it mounts', () => {
    const store = useAgentWorkflowChatsStore()
    store.openChat('workflows/a.json', 'th-1')

    useAgentPanelStore().close('topbar_button')

    expect(store.takePendingRequest()).toBeNull()
  })

  it('keeps the newest chat list when an older read finishes last', async () => {
    const store = useAgentWorkflowChatsStore()
    const pending: ((response: Response) => void)[] = []
    respondToFetch(
      threadsRoute,
      () => new Promise<Response>((resolve) => pending.push(resolve))
    )

    const older = store.loadChats()
    const newer = store.loadChats()
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1](threadList('newest'))
    await newer
    pending[0](threadList('stale'))

    expect(await older).toEqual({ ok: true })
    expect(useAgentChatHistoryStore().sessions.map(({ id }) => id)).toEqual([
      'newest'
    ])
  })
})
