import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { fromPartial } from '@total-typescript/shoehorn'

import type {
  AgentThreadListResponse,
  AgentThreadSummary
} from '@comfyorg/ingest-types'
import type { User } from 'firebase/auth'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

vi.mock(import('firebase/auth'))

import { i18n } from '@/i18n'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { getFilenameDetails } from '@/utils/formatUtil'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import AgentPanelRoot from './AgentPanelRoot.vue'
import { setupInlinePromptEditorDom } from './components/agent/composer/inlinePromptEditorTestSetup'
import { createFakeAgentSocket } from './crdt/__fixtures__/agentSocket'
import type { AgentMessages } from './schemas/agentApiSchema'
import { zAgentMessages } from './schemas/agentApiSchema'
import { createAgentEventSource } from './services/agent/agentEventSource'
import { resolveAgentIdentity } from './services/agent/agentIdentity'
import type { AgentIdentityState } from './services/agent/agentIdentity'
import { registerWorkflowTabActivityTracker } from './services/agent/workflowTabActivityTracker'
import { useAgentChatHistoryStore } from './stores/agent/agentChatHistoryStore'
import { useAgentConsentStore } from './stores/agent/agentConsentStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from './stores/agent/agentWorkflowTabBindingStore'

setupInlinePromptEditorDom()

vi.mock(import('@/scripts/api'))

vi.mock<unknown>(import('@/scripts/app'), () => {
  const graph = {
    nodes: [],
    _nodes: [],
    _nodes_by_id: {},
    subgraphs: new Map(),
    serialize: () => ({ version: 0.4, nodes: [] })
  }
  return {
    app: {
      graph,
      rootGraph: graph,
      isGraphReady: false,
      canvas: undefined,
      ui: { autoQueueEnabled: false }
    }
  }
})

vi.mock<unknown>(import('./composables/agent/useAgentConsent'), () => ({
  useAgentConsent: () => ({
    withConsent: async (_trigger: unknown, onAccept: () => void) => onAccept()
  })
}))
vi.mock<unknown>(import('@/composables/canvas/useFocusNode'), () => ({
  useFocusNode: () => ({ focusNodeInstance: vi.fn() })
}))
vi.mock<unknown>(
  import('@/platform/billing/subscription/composables/useAccountPreconditionDialog'),
  () => ({ useAccountPreconditionDialog: () => ({ open: vi.fn() }) })
)
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/platform/billing/composables/useBillingContext'), {
  spy: true
})
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'), {
  spy: true
})
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'), {
  spy: true
})
vi.mock(import('./services/agent/agentEventSource'), { spy: true })
vi.mock(import('./services/agent/agentIdentity'), { spy: true })

const runningTab = 'workflows/current.json'
const otherTab = 'workflows/other.json'

let agentSocket: ReturnType<typeof createFakeAgentSocket>
let workflowStore: ReturnType<typeof useWorkflowStore>
let stopTracker: () => void
let transcripts: Partial<Record<string, AgentMessages>> = {}
let acks: { message_id: string; workflow_id?: string }[] = []

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const threadMessagesUrl = /\/threads\/([^/]+)\/messages/

function threadTranscript(input: RequestInfo | URL): Response {
  const [, thread = ''] = threadMessagesUrl.exec(String(input)) ?? []
  return json(200, transcripts[thread] ?? [])
}

function agentThread(id: string, title: string): AgentThreadSummary {
  return {
    created_at: '2026-10-15T10:00:00Z',
    id,
    last_message_at: '2026-10-15T10:00:00Z',
    message_count: 0,
    preview: '',
    status: 'active',
    title,
    updated_at: '2026-10-15T10:00:00Z',
    workflow_id: ''
  }
}

const threadList = {
  threads: [
    agentThread('th-1', 'Running chat'),
    agentThread('th-2', 'Other chat')
  ],
  pagination: { has_more: false, limit: 2, offset: 0, total: 2 }
} satisfies AgentThreadListResponse

function addTab(
  path: string,
  overrides: Partial<LoadedComfyWorkflow> = {}
): LoadedComfyWorkflow {
  const slash = path.lastIndexOf('/')
  const { filename, suffix } = getFilenameDetails(path.slice(slash + 1))
  const tab = createMockLoadedWorkflow({
    instanceId: path,
    path,
    directory: path.slice(0, slash),
    filename,
    suffix,
    isTemporary: false,
    isModified: false,
    activeState: null,
    ...overrides
  })
  tab.load = vi.fn(async () => tab)
  tab.unload = vi.fn()
  tab.rename = vi.fn(async (newPath: string) => {
    const renamed = getFilenameDetails(
      newPath.slice(newPath.lastIndexOf('/') + 1)
    )
    Object.assign(tab, { path: newPath, ...renamed })
    return tab
  })
  workflowStore.attachWorkflow(tab, workflowStore.openWorkflows.length)
  workflowStore.openWorkflowsInBackground({ right: [tab.path] })
  return tab
}

function addBoundTab(path: string, workflowId: string): LoadedComfyWorkflow {
  const tab = addTab(path, {
    activeState: fromPartial<ComfyWorkflowJSON>({ id: workflowId })
  })
  useAgentWorkflowTabBindingStore().bind(workflowId, tab.path)
  return tab
}

function renderPanel() {
  const active = workflowStore.activeWorkflow
  useAgentPanelStore().setWorkflowTarget(
    active ? fromPartial<ComfyWorkflow>(active) : null
  )
  return render(AgentPanelRoot, { global: { plugins: [i18n] } })
}

async function send(text: string): Promise<void> {
  await userEvent.click(screen.getByRole('textbox'))
  await userEvent.paste(text)
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
  await screen.findByRole('button', { name: 'Stop' })
}

async function openChat(title: string, threadId: string): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: i18n.global.t('agent.showChatHistory') })
  )
  await userEvent.click(await screen.findByRole('button', { name: title }))
  await vi.waitFor(() =>
    expect(useAgentChatHistoryStore().activeId).toBe(threadId)
  )
}

function emitRunApproval(): void {
  agentSocket.receive('agent_ask', {
    thread_id: 'th-1',
    message_id: 'm-1',
    ask_id: 'm-1:call-1',
    kind: 'run_approval',
    prompt: 'Run it?',
    options: [
      { id: 'run', label: 'Run' },
      { id: 'cancel', label: 'Cancel' }
    ],
    min_selections: 1,
    max_selections: 1,
    allow_other: false
  })
}

function emitDone(): void {
  agentSocket.receive('agent_message_done', {
    message_id: 'm-1',
    thread_id: 'th-1'
  })
}

function userRow(threadId: string, workflowId?: string) {
  return {
    id: `u-${threadId}`,
    thread_id: threadId,
    seq: 1,
    role: 'user',
    status: 'complete',
    turn_id: `turn-${threadId}`,
    content: { text: 'make it blue' },
    ...(workflowId === undefined ? {} : { workflow_id: workflowId })
  }
}

function liveOtherThread(workflowId?: string): AgentMessages {
  return zAgentMessages.parse([
    userRow('th-2', workflowId),
    {
      id: 'm-2',
      thread_id: 'th-2',
      seq: 2,
      role: 'assistant',
      status: 'streaming',
      turn_id: 'turn-th-2',
      content: { text: '' }
    }
  ])
}

beforeEach(() => {
  vi.useRealTimers()
  vi.mocked(api.fetchApi).mockImplementation((route, options) =>
    fetch(route.startsWith('/api') ? route : `/api${route}`, options)
  )
  api.socket = fromPartial<WebSocket>({ readyState: 1, send: vi.fn() })
  agentSocket = createFakeAgentSocket()
  vi.mocked(createAgentEventSource).mockReturnValue(agentSocket.socket)
  vi.mocked(resolveAgentIdentity).mockReturnValue({
    state: ref<AgentIdentityState>({ status: 'resolved', userId: 'account-a' }),
    reset: vi.fn(),
    stop: () => {}
  })
  useAuthStore().currentUser = fromPartial<User>({ uid: 'account-a' })
  vi.spyOn(useAuthStore(), 'getUserAuthHeader').mockResolvedValue({
    Authorization: 'Bearer id-token'
  })
  localStorage.clear()
  localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
  transcripts = {}
  acks = []
  useCurrentUser().isLoggedIn = computed(() => true)
  useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'account-a' }))
  Object.assign(useAgentConsentStore(), { accepted: true })
  vi.mocked(useWorkspaceUI).mockReturnValue(
    fromPartial({ workspaceRole: computed(() => 'owner' as const) })
  )
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      subscription: computed(() =>
        fromPartial({ hasFunds: true, agentHasFunds: true })
      ),
      tier: computed(() => 'STANDARD' as const),
      type: computed(() => 'legacy' as const),
      billingStatus: computed(() => 'paid' as const),
      canAccessSubscriptionFeatures: computed(() => true),
      fetchStatus: vi.fn(async () => {})
    })
  )
  vi.mocked(useBillingCapabilities).mockReturnValue(
    fromPartial({
      canTopUp: computed(() => true),
      canSubscribeSelfServe: computed(() => true),
      isReady: computed(() => true),
      hasResolvedCapabilities: computed(() => true),
      snapshotAuthoritative: computed(() => true)
    })
  )
  workflowStore = useWorkflowStore()
  vi.mocked(workflowStore.syncWorkflows).mockResolvedValue(undefined)
  vi.mocked(useWorkflowService()).openWorkflow.mockImplementation(
    async (tab, options) => {
      workflowStore.activeWorkflow = await tab.load()
      if (options?.initiator === 'user') workflowStore.reportUserActivation(tab)
      return true
    }
  )
  vi.mocked(useWorkflowService()).closeWorkflow.mockImplementation(
    async (tab) => {
      await workflowStore.closeWorkflow(tab)
      return true
    }
  )
  vi.mocked(fetch).mockImplementation(async () => json(200, {}))
  respondToFetch(/\/assets/, () =>
    json(200, { assets: [], total: 0, has_more: false })
  )
  respondToFetch(/\/agent\/threads/, () => json(200, threadList))
  respondToFetch(threadMessagesUrl, threadTranscript)
  respondToFetch({ method: 'POST', url: /\/messages/ }, () =>
    json(202, {
      thread_id: 'th-1',
      ...(acks.shift() ?? { message_id: 'm-1', workflow_id: 'wf-42' })
    })
  )
  respondToFetch(/\/asks\//, () => json(200, { status: 'answered' }))
  workflowStore.activeWorkflow = addBoundTab(runningTab, 'wf-42')
  stopTracker = registerWorkflowTabActivityTracker(ref(true))
})

afterEach(() => {
  stopTracker()
})

describe('AgentPanelRoot tab activity across chats', () => {
  it('keeps A and B spinning independently after following their chats to C', async () => {
    const other = addBoundTab(otherTab, 'wf-other')
    const thirdTab = 'workflows/third.json'
    const third = addBoundTab(thirdTab, 'wf-third')
    respondToFetch(/\/workflows(?:\?|$)/, () =>
      json(200, {
        data: [
          { id: 'wf-42', name: 'current' },
          { id: 'wf-other', name: 'other' },
          { id: 'wf-third', name: 'third' }
        ],
        pagination: { offset: 0, limit: 100, total: 3, has_more: false }
      })
    )
    respondToFetch(/\/agent\/threads(?:\?|$)/, () =>
      json(200, {
        ...threadList,
        threads: [
          { ...agentThread('th-1', 'Running chat'), workflow_id: 'wf-42' },
          { ...agentThread('th-2', 'Other chat'), workflow_id: 'wf-other' },
          { ...agentThread('th-3', 'Third chat'), workflow_id: 'wf-third' }
        ],
        pagination: { has_more: false, limit: 3, offset: 0, total: 3 }
      })
    )
    let answerOther!: () => void
    const otherTranscript = new Promise<Response>((resolve) => {
      answerOther = () => resolve(json(200, liveOtherThread('wf-42')))
    })
    respondToFetch('/api/agent/threads/th-2/messages', () => otherTranscript)
    renderPanel()
    await send('add an upscaler')

    await useWorkflowService().openWorkflow(other, { initiator: 'user' })

    expect(screen.getByTestId('agent-panel-footer')).toHaveAttribute('inert')
    expect(
      await screen.findByRole('status', {
        name: i18n.global.t('agent.openingWorkflowChat', {
          workflowName: 'other'
        })
      })
    ).toBeVisible()
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])
    expect(useAgentConversationStore().threadId).toBe('th-1')

    answerOther()
    await vi.waitFor(() =>
      expect(useAgentChatHistoryStore().activeId).toBe('th-2')
    )

    expect(
      screen.queryByRole('status', {
        name: i18n.global.t('agent.openingWorkflowChat', {
          workflowName: 'other'
        })
      })
    ).toBeNull()
    expect(screen.getByTestId('agent-panel-footer')).not.toHaveAttribute(
      'inert'
    )
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(otherTab)
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      otherTab,
      runningTab
    ])
    expect([...useWorkflowTabActivityStore().unseenModifiedPaths]).toEqual([])

    await useWorkflowService().openWorkflow(third, { initiator: 'user' })
    await vi.waitFor(() =>
      expect(useAgentChatHistoryStore().activeId).toBe('th-3')
    )

    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(thirdTab)
    expect(useAgentConversationStore().threadId).toBe('th-3')
    expect(useWorkflowTabActivityStore().editingPaths).toEqual(
      new Set([runningTab, otherTab])
    )
    expect([...useWorkflowTabActivityStore().unseenModifiedPaths]).toEqual([])

    emitDone()
    await nextTick()

    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([otherTab])
    expect([...useWorkflowTabActivityStore().unseenModifiedPaths]).toEqual([
      runningTab
    ])
    expect(useAgentConversationStore().threadId).toBe('th-3')

    agentSocket.receive('agent_message_done', {
      message_id: 'm-2',
      thread_id: 'th-2'
    })
    await nextTick()

    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([])
    expect(useWorkflowTabActivityStore().unseenModifiedPaths).toEqual(
      new Set([runningTab, otherTab])
    )
    expect(useAgentPanelStore().selectedWorkflow?.path).toBe(thirdTab)
    expect(useAgentConversationStore().threadId).toBe('th-3')
  })

  it('keeps the spinner on the tab while its chat runs in the background', async () => {
    renderPanel()
    await send('add an upscaler')
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])

    await openChat('Other chat', 'th-2')

    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])
    expect(
      useWorkflowTabActivityStore().unseenModifiedPaths.has(runningTab)
    ).toBe(false)
  })

  it.for([
    {
      chat: 'open',
      selectChat: () => {},
      frame: 'done',
      message: { message_id: 'm-1', thread_id: 'th-1' },
      modified: true
    },
    {
      chat: 'open',
      selectChat: () => {},
      frame: 'malformed done',
      message: { message_id: 'm-1' },
      modified: false
    },
    {
      chat: 'background',
      selectChat: () => openChat('Other chat', 'th-2'),
      frame: 'done',
      message: { message_id: 'm-1', thread_id: 'th-1' },
      modified: true
    },
    {
      chat: 'background',
      selectChat: () => openChat('Other chat', 'th-2'),
      frame: 'malformed done',
      message: { message_id: 'm-1' },
      modified: false
    }
  ])(
    'stops the spinner when the $chat chat gets a $frame frame',
    async ({ selectChat, message, modified }) => {
      renderPanel()
      await send('add an upscaler')
      await selectChat()
      expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
        runningTab
      ])

      agentSocket.receive('agent_message_done', message)
      await nextTick()

      expect(useWorkflowTabActivityStore().editingPaths.size).toBe(0)
      expect(
        useWorkflowTabActivityStore().unseenModifiedPaths.has(runningTab)
      ).toBe(modified)
    }
  )

  it('keeps the spinner on a reopened running chat until its turn ends', async () => {
    renderPanel()
    await send('add an upscaler')
    await openChat('Other chat', 'th-2')
    await openChat('Running chat', 'th-1')
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])
    expect(
      useWorkflowTabActivityStore().unseenModifiedPaths.has(runningTab)
    ).toBe(false)

    emitDone()
    await nextTick()

    expect(useWorkflowTabActivityStore().editingPaths.size).toBe(0)
    expect(
      useWorkflowTabActivityStore().unseenModifiedPaths.has(runningTab)
    ).toBe(true)
  })

  it('keeps a background chat spinning across a panel remount and marks it when it completes', async () => {
    const { unmount } = renderPanel()
    await send('add an upscaler')
    await openChat('Other chat', 'th-2')

    unmount()
    renderPanel()
    await vi.waitFor(() =>
      expect(useAgentChatHistoryStore().activeId).toBe('th-2')
    )

    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])

    emitDone()
    await nextTick()

    expect(useWorkflowTabActivityStore().editingPaths.size).toBe(0)
    expect(
      useWorkflowTabActivityStore().unseenModifiedPaths.has(runningTab)
    ).toBe(true)
  })

  it('moves the tab of the chat that asked for it when the user switches chats mid-open', async () => {
    addBoundTab(otherTab, 'wf-other')
    transcripts['th-2'] = liveOtherThread()
    renderPanel()
    await send('add an upscaler')
    let finishOpening!: () => void
    vi.mocked(useWorkflowService()).openWorkflow.mockImplementationOnce(
      (tab) =>
        new Promise((resolve) => {
          finishOpening = () => {
            workflowStore.activeWorkflow = tab as LoadedComfyWorkflow
            resolve(true)
          }
        })
    )

    agentSocket.receive('agent_active_tab', {
      workflow_id: 'wf-other',
      thread_id: 'th-1'
    })
    await vi.waitFor(() =>
      expect(useWorkflowService().openWorkflow).toHaveBeenCalled()
    )
    await openChat('Other chat', 'th-2')
    finishOpening()
    await vi.waitFor(() =>
      expect(useAgentWorkflowTabBindingStore().tabPathFor('wf-other')).toBe(
        otherTab
      )
    )
    await nextTick()
    expect(useWorkflowTabActivityStore().editingPaths.has(otherTab)).toBe(true)

    emitDone()
    await nextTick()

    expect(useWorkflowTabActivityStore().editingPaths.has(otherTab)).toBe(false)
    expect(
      useWorkflowTabActivityStore().unseenModifiedPaths.has(otherTab)
    ).toBe(true)
    expect(
      useWorkflowTabActivityStore().unseenModifiedPaths.has(runningTab)
    ).toBe(false)
  })

  it.for([
    {
      asked: 'while the chat is open',
      beforeAsk: () => {},
      afterAsk: () => {}
    },
    {
      asked: 'while the chat is in the background',
      beforeAsk: () => openChat('Other chat', 'th-2'),
      afterAsk: () => {}
    },
    {
      asked: 'and then the chat is stashed',
      beforeAsk: () => {},
      afterAsk: () => openChat('Other chat', 'th-2')
    }
  ])(
    'marks the tab as needing approval when asked $asked',
    async ({ beforeAsk, afterAsk }) => {
      renderPanel()
      await send('add an upscaler')
      await beforeAsk()
      expect(useWorkflowTabActivityStore().awaitingApprovalPaths.size).toBe(0)

      emitRunApproval()
      await nextTick()
      await afterAsk()
      expect([...useWorkflowTabActivityStore().awaitingApprovalPaths]).toEqual([
        runningTab
      ])

      agentSocket.receive('agent_ask_resolved', {
        thread_id: 'th-1',
        message_id: 'm-1',
        ask_id: 'm-1:call-1',
        status: 'answered',
        selected: ['run']
      })
      await nextTick()

      expect(useWorkflowTabActivityStore().awaitingApprovalPaths.size).toBe(0)
      expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
        runningTab
      ])
    }
  )

  it('stops showing needs-approval once the user answers, before the server confirms', async () => {
    renderPanel()
    await send('add an upscaler')
    emitRunApproval()
    await nextTick()
    expect([...useWorkflowTabActivityStore().awaitingApprovalPaths]).toEqual([
      runningTab
    ])

    await userEvent.click(await screen.findByRole('button', { name: 'Run' }))
    await vi.waitFor(() =>
      expect(fetchRequests({ method: 'POST', url: /\/asks\// })).toHaveLength(1)
    )
    await nextTick()

    expect(useWorkflowTabActivityStore().awaitingApprovalPaths.size).toBe(0)
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])

    await openChat('Other chat', 'th-2')

    expect(useWorkflowTabActivityStore().awaitingApprovalPaths.size).toBe(0)
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])
  })

  it('follows the tab when it is renamed mid-turn', async () => {
    const tab = workflowStore.activeWorkflow!
    renderPanel()
    await send('add an upscaler')

    await workflowStore.renameWorkflow(tab, 'workflows/renamed.json')
    await nextTick()

    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      'workflows/renamed.json'
    ])

    emitDone()
    await nextTick()

    expect(useWorkflowTabActivityStore().editingPaths.size).toBe(0)
    expect(
      useWorkflowTabActivityStore().unseenModifiedPaths.has(
        'workflows/renamed.json'
      )
    ).toBe(true)
  })

  it('drops the spinner when the tab closes mid-turn, even for a new tab with the same name', async () => {
    addTab(otherTab)
    const tab = workflowStore.activeWorkflow!
    renderPanel()
    await send('add an upscaler')

    await workflowStore.closeWorkflow(tab)
    await nextTick()
    expect(useWorkflowTabActivityStore().editingPaths.size).toBe(0)

    addTab(runningTab, { instanceId: 'same-name-replacement' })
    await nextTick()
    expect(useWorkflowTabActivityStore().editingPaths.size).toBe(0)
  })

  it.for([
    { workflow: 'wf-other', spinning: [otherTab] },
    { workflow: undefined, spinning: [] }
  ])(
    'spins the tab of a running chat opened from history once its workflow ($workflow) is restored',
    async ({ workflow, spinning }) => {
      addBoundTab(otherTab, 'wf-other')
      transcripts['th-2'] = liveOtherThread(workflow)
      renderPanel()

      await openChat('Other chat', 'th-2')
      await vi.waitFor(() =>
        expect(useAgentConversationStore().activeTurnId).toBe('m-2')
      )
      await nextTick()

      await vi.waitFor(() =>
        expect([...useWorkflowTabActivityStore().editingPaths]).toEqual(
          spinning
        )
      )
    }
  )

  it("keeps a guessed turn on its tab when a remount finds the chat's workflow already decided", async () => {
    addBoundTab(otherTab, 'wf-other')
    transcripts['th-1'] = zAgentMessages.parse([userRow('th-1', 'wf-other')])
    acks = [{ message_id: 'm-1' }]
    const { unmount } = renderPanel()
    await send('add an upscaler')
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])

    unmount()
    renderPanel()
    await vi.waitFor(() =>
      expect(useAgentConversationStore().activeTurnId).toBe('m-1')
    )
    await nextTick()

    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])
  })

  it('moves the tab of the turn named by agent_active_tab, not the latest one', async () => {
    addBoundTab(otherTab, 'wf-other')
    acks = [
      { message_id: 'm-1', workflow_id: 'wf-42' },
      { message_id: 'm-2', workflow_id: 'wf-42' }
    ]
    renderPanel()
    await send('first')
    emitDone()
    await screen.findByRole('button', { name: 'Send' })
    await send('second')

    agentSocket.receive('agent_active_tab', {
      workflow_id: 'wf-other',
      thread_id: 'th-1',
      message_id: 'm-1'
    })
    await vi.waitFor(() =>
      expect(workflowStore.activeWorkflow?.path).toBe(otherTab)
    )
    await nextTick()

    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([
      runningTab
    ])
  })

  it('marks a completed tab once after a remount and stops listening when unmounted', async () => {
    const first = renderPanel()
    await send('add an upscaler')
    first.unmount()
    renderPanel()
    await vi.waitFor(() =>
      expect(useAgentConversationStore().activeTurnId).toBe('m-1')
    )
    const markModified = vi.spyOn(useWorkflowTabActivityStore(), 'markModified')

    emitDone()

    expect(markModified.mock.calls).toEqual([[runningTab]])
  })

  it("does not move a reopened chat's turn onto the workflow restored for that chat", async () => {
    const tab = workflowStore.activeWorkflow!
    addBoundTab(otherTab, 'wf-other')
    transcripts['th-1'] = zAgentMessages.parse([userRow('th-1', 'wf-other')])
    renderPanel()
    await send('add an upscaler')
    await workflowStore.closeWorkflow(tab)
    await openChat('Other chat', 'th-2')

    await openChat('Running chat', 'th-1')
    await vi.waitFor(() =>
      expect(useAgentPanelStore().selectedWorkflow?.path).toBe(otherTab)
    )
    await nextTick()

    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
    expect([...useWorkflowTabActivityStore().editingPaths]).toEqual([])
  })
})
