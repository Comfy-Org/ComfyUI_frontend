import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import type {
  AgentThreadListResponse,
  AgentThreadSummary,
  WorkflowListResponse,
  WorkflowResponse
} from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { useAgentPanelStore } from '../../stores/agent/agentPanelStore'
import {
  FOCUS_REFRESH_INTERVAL_MS,
  registerWorkflowAgentChatsTracker
} from './workflowAgentChatsTracker'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry/reportError'))

const threadsRoute = /\/api\/agent\/threads(\?|$)/
const workflowsRoute = /\/api\/workflows(\?|$)/

function thread(
  id: string,
  workflowId: string,
  lastMessageAt: string
): AgentThreadSummary {
  return {
    created_at: lastMessageAt,
    id,
    last_message_at: lastMessageAt,
    message_count: 1,
    preview: '',
    status: 'active',
    title: id,
    updated_at: lastMessageAt,
    workflow_id: workflowId
  }
}

function threadList(threads: AgentThreadSummary[]): Response {
  return Response.json({
    threads,
    pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
  } satisfies AgentThreadListResponse)
}

function cloudWorkflow(id: string, name: string): WorkflowResponse {
  return {
    id,
    name,
    latest_version: 1,
    created_by: 'user-1',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z'
  }
}

function workflowList(rows: WorkflowResponse[]): Response {
  return Response.json({
    data: rows,
    pagination: { has_more: false, limit: 100, offset: 0, total: rows.length }
  } satisfies WorkflowListResponse)
}

function savedWorkflow(path: string, open: boolean): LoadedComfyWorkflow {
  const slash = path.lastIndexOf('/')
  const workflow = createMockLoadedWorkflow({
    path,
    directory: path.slice(0, slash),
    filename: path.slice(slash + 1).replace(/\.json$/, ''),
    suffix: 'json',
    isTemporary: false,
    save: vi.fn(),
    rename: vi.fn(async (newPath: string) => {
      Object.assign(workflow, {
        path: newPath,
        filename: newPath.slice(newPath.lastIndexOf('/') + 1, -'.json'.length)
      })
    })
  })
  const workflowStore = useWorkflowStore()
  workflowStore.attachWorkflow(
    workflow,
    open ? workflowStore.openWorkflows.length : -1
  )
  return workflow
}

const cloudIndex = [
  cloudWorkflow('wf-portrait', 'portrait'),
  cloudWorkflow('wf-landscape', 'landscape'),
  cloudWorkflow('wf-archive', 'archive')
]

const chats = [
  thread('portrait-older', 'wf-portrait', '2026-10-01T10:00:00Z'),
  thread('portrait-newer', 'wf-portrait', '2026-10-08T10:00:00Z'),
  thread('landscape', 'wf-landscape', '2026-10-05T10:00:00Z'),
  thread('archived', 'wf-archive', '2026-10-03T10:00:00Z'),
  thread('elsewhere', 'wf-unknown', '2026-10-09T10:00:00Z')
]

function chatTitles(path: string): string[] {
  return (
    useWorkflowTabActivityStore()
      .agentChatsByPath.get(path)
      ?.map(({ title }) => title) ?? []
  )
}

function setupWorkflows() {
  const portrait = savedWorkflow('workflows/portrait.json', true)
  const landscape = savedWorkflow('workflows/landscape.json', true)
  const archive = savedWorkflow('workflows/old/archive.json', false)
  const draft = createMockLoadedWorkflow({
    path: 'workflows/Unsaved Workflow.json',
    filename: 'Unsaved Workflow',
    suffix: 'json',
    isTemporary: true,
    save: vi.fn(async () => {
      Object.assign(draft, { isTemporary: false })
    })
  })
  useWorkflowStore().attachWorkflow(draft, 2)
  useWorkflowStore().activeWorkflow = portrait
  return { portrait, landscape, archive, draft }
}

function track(available = ref(true)) {
  onTestFinished(registerWorkflowAgentChatsTracker(available))
  return available
}

async function trackLoaded() {
  const workflows = setupWorkflows()
  const available = track()
  await vi.waitFor(() =>
    expect(chatTitles(workflows.portrait.path)).not.toHaveLength(0)
  )
  return { ...workflows, available }
}

describe('registerWorkflowAgentChatsTracker', () => {
  beforeEach(() => {
    vi.mocked(api.fetchApi).mockImplementation((route, options) =>
      fetch(`/api${route}`, options)
    )
    respondToFetch(threadsRoute, () => threadList(chats))
    respondToFetch(workflowsRoute, () => workflowList(cloudIndex))
  })

  it('makes no requests until the agent is available, then reads chats and the Cloud index once', async () => {
    setupWorkflows()
    const available = track(ref(false))
    await nextTick()
    expect(fetch).not.toHaveBeenCalled()

    available.value = true

    await vi.waitFor(() => expect(fetchRequests(threadsRoute)).toHaveLength(1))
    expect(fetchRequests(workflowsRoute)).toHaveLength(1)
  })

  it('lists the chats on each open tab and closed saved workflow, newest first, before the panel has opened', async () => {
    const { portrait, landscape, archive, draft } = await trackLoaded()

    expect(chatTitles(portrait.path)).toEqual([
      'portrait-newer',
      'portrait-older'
    ])
    expect(chatTitles(landscape.path)).toEqual(['landscape'])
    expect(chatTitles(archive.path)).toEqual(['archived'])
    expect(useWorkflowTabActivityStore().agentChatsByPath.has(draft.path)).toBe(
      false
    )
  })

  it('keeps the chat the panel is in, marked as current', async () => {
    const { portrait } = await trackLoaded()

    useAgentConversationStore().setThreadId('portrait-newer')
    await nextTick()

    expect(
      useWorkflowTabActivityStore()
        .agentChatsByPath.get(portrait.path)
        ?.map(({ title, current }) => ({ title, current }))
    ).toEqual([
      { title: 'portrait-newer', current: true },
      { title: 'portrait-older', current: false }
    ])
  })

  it('offers workflow chats only while the agent is available', async () => {
    const { available } = await trackLoaded()
    const tabActivity = useWorkflowTabActivityStore()
    expect(tabActivity.agentChatsEnabled).toBe(true)

    available.value = false
    await nextTick()

    expect(tabActivity.agentChatsEnabled).toBe(false)
    expect(tabActivity.agentChatsByPath.size).toBe(0)
  })

  it('reads chats once more after a burst of tab switches instead of once per switch', async () => {
    const { portrait, landscape } = await trackLoaded()
    const pending: ((response: Response) => void)[] = []
    respondToFetch(
      threadsRoute,
      () => new Promise<Response>((resolve) => pending.push(resolve))
    )
    const workflowStore = useWorkflowStore()

    workflowStore.activeWorkflow = landscape
    await nextTick()
    workflowStore.activeWorkflow = portrait
    await nextTick()
    workflowStore.activeWorkflow = landscape
    await nextTick()
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    pending[0](threadList(chats))
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1](threadList(chats.slice(2)))

    await vi.waitFor(() => expect(chatTitles(portrait.path)).toEqual([]))
    expect(chatTitles(landscape.path)).toEqual(['landscape'])
    expect(pending).toHaveLength(2)
  })

  it('reads chats when the panel’s current chat changes, but not while a chat is still opening', async () => {
    await trackLoaded()
    const panel = useAgentPanelStore()
    const conversation = useAgentConversationStore()

    panel.view = { screen: 'opening', id: 'landscape', previousThreadId: null }
    conversation.setThreadId('landscape')
    await nextTick()
    expect(fetchRequests(threadsRoute)).toHaveLength(1)

    panel.view = { screen: 'chat' }
    conversation.setThreadId(null)

    await vi.waitFor(() => expect(fetchRequests(threadsRoute)).toHaveLength(2))
  })

  it('reads nothing on a switch to a tab without a Cloud identity', async () => {
    const { draft } = await trackLoaded()

    useWorkflowStore().activeWorkflow = draft
    await nextTick()

    expect(fetchRequests(threadsRoute)).toHaveLength(1)
  })

  it('refreshes chats and the Cloud index on window focus, at most once per interval', async () => {
    await trackLoaded()

    window.dispatchEvent(new Event('focus'))
    expect(fetchRequests(threadsRoute)).toHaveLength(1)

    vi.advanceTimersByTime(FOCUS_REFRESH_INTERVAL_MS)
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))

    await vi.waitFor(() => expect(fetchRequests(threadsRoute)).toHaveLength(2))
    expect(fetchRequests(workflowsRoute)).toHaveLength(2)
  })

  it('keeps a renamed workflow’s chats by refreshing the Cloud index', async () => {
    const { archive } = await trackLoaded()
    respondToFetch(workflowsRoute, () =>
      workflowList([
        ...cloudIndex.slice(0, 2),
        cloudWorkflow('wf-archive', 'archive 2025')
      ])
    )

    await useWorkflowStore().renameWorkflow(
      archive,
      'workflows/old/archive 2025.json'
    )

    await vi.waitFor(() =>
      expect(chatTitles('workflows/old/archive 2025.json')).toEqual([
        'archived'
      ])
    )
    expect(fetchRequests(workflowsRoute)).toHaveLength(2)
  })

  it('refreshes the Cloud index when a draft is first saved, not on later saves', async () => {
    const { portrait, draft } = await trackLoaded()
    const workflowStore = useWorkflowStore()

    await workflowStore.saveWorkflow(draft)
    await vi.waitFor(() =>
      expect(fetchRequests(workflowsRoute)).toHaveLength(2)
    )
    await workflowStore.saveWorkflow(portrait)
    await workflowStore.saveWorkflow(draft)
    await nextTick()

    expect(fetchRequests(workflowsRoute)).toHaveLength(2)
  })

  it.for([
    {
      outcome: 'fails',
      respond: () => Response.json({ error: 'unavailable' }, { status: 500 })
    },
    {
      outcome: 'ends before its last page',
      respond: () =>
        Response.json({
          threads: [],
          pagination: { has_more: true, limit: 100, offset: 0, total: 3 }
        } satisfies AgentThreadListResponse)
    }
  ])(
    'keeps the last list and reports once when a background read $outcome',
    async ({ respond }) => {
      const { portrait, landscape } = await trackLoaded()
      respondToFetch(threadsRoute, respond)

      useWorkflowStore().activeWorkflow = landscape

      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(expect.anything(), {
          surface: 'agent',
          errorType: 'agent_thread_list_load_failed'
        })
      )
      expect(reportError).toHaveBeenCalledOnce()
      expect(chatTitles(portrait.path)).toEqual([
        'portrait-newer',
        'portrait-older'
      ])
    }
  )
})
