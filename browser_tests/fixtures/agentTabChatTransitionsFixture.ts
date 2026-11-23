import type {
  AgentMessage,
  AgentPostMessageRequest,
  AgentRunMode,
  AgentSkillListResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { Page, Route, WebSocketRoute } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AGENT_SOCKET_URL } from '@e2e/fixtures/agentSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { WorkflowsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import {
  agentThreadSummary,
  agentUserTranscript
} from '@e2e/fixtures/data/agent/agentThreadList'
import { AgentWorkflowChatsMock } from '@e2e/fixtures/helpers/agentWorkflowChats'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { nextFrame } from '@e2e/fixtures/utils/timing'

const WORKFLOWS = [
  { name: 'Portrait', id: 'af1dcab5-b7e9-47ac-b1cf-c6fd1f803a31' },
  { name: 'Landscape', id: 'b98ed2f5-089b-46e8-b650-9d8c387bb15b' },
  { name: 'Still Life', id: 'c23d77bf-68dc-45e3-b8bf-8f142d570e31' }
]
const THREADS = [
  'e43232b2-1f56-4f7f-a905-a808dce1b811',
  'fbd667e5-137e-4a8a-ab28-c3b6101d85dc',
  'a89fc2bf-3fdd-4d61-9305-e316fa079323'
]
const SKILL_NAME = 'tab-preservation'
const SKILLS: AgentSkillListResponse = {
  skills: [
    {
      id: 'tab-preservation-skill',
      name: SKILL_NAME,
      description: 'A fixture skill for testing draft retention.',
      body: 'Reply briefly; do not run workflows.',
      body_hash: 'a'.repeat(64),
      created_at: '2026-10-16T00:00:00Z',
      updated_at: '2026-10-16T00:00:00Z'
    }
  ]
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

class TabChatTransitions {
  readonly panel: AgentPanel
  readonly topbar: Topbar
  readonly workflows = WORKFLOWS
  readonly threads = THREADS
  readonly skillName = SKILL_NAME
  readonly posted: {
    requestedThreadId: string
    threadId: string
    body: AgentPostMessageRequest
  }[] = []
  readonly unexpectedMutations: string[] = []
  private agentSocket: WebSocketRoute | undefined
  private graphLoadHeld = false
  private held:
    | {
        threadId: string
        status: number
        started: boolean
        entered: ReturnType<typeof deferred>
        release: ReturnType<typeof deferred>
        settled: ReturnType<typeof deferred>
      }
    | undefined
  private readonly transcripts: Record<string, AgentMessage[]>
  private readonly threadsList: ReturnType<typeof agentThreadSummary>[]
  private readonly workflowsList: typeof WORKFLOWS
  private createdThreads = 0

  constructor(
    private readonly page: Page,
    private readonly blankMode = false
  ) {
    this.panel = new AgentPanel(page)
    this.topbar = new Topbar(page)
    this.workflowsList = WORKFLOWS
    this.threadsList = blankMode
      ? []
      : WORKFLOWS.map(({ name, id }, index) =>
          agentThreadSummary(THREADS[index], `${name} chat`, {
            workflow_id: id,
            preview: `${name} existing request`
          })
        )
    this.transcripts = blankMode
      ? {}
      : Object.fromEntries(
          WORKFLOWS.map(({ name, id }, index) => [
            THREADS[index],
            agentUserTranscript(THREADS[index], id, `${name} existing request`)
          ])
        )
  }

  async install(): Promise<void> {
    await this.page.route(
      (url) => url.pathname.startsWith('/api/'),
      (route) => {
        if (route.request().method() !== 'GET')
          this.unexpectedMutations.push(
            `${route.request().method()} ${new URL(route.request().url()).pathname}`
          )
        return route.fulfill({ status: 404, json: {} })
      }
    )
    await this.page.routeWebSocket(AGENT_SOCKET_URL, (socket) => {
      this.agentSocket = socket
    })
    await this.page.routeWebSocket(/\/ws(?:\?|$)/, (socket) => {
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            sid: 'tab-chats',
            status: { exec_info: { queue_remaining: 0 } }
          }
        })
      )
    })
  }

  async routeChats(): Promise<void> {
    const chats = new AgentWorkflowChatsMock({
      workflows: this.workflowsList.map((workflow) => ({
        ...workflow,
        content: {
          last_node_id: 0,
          last_link_id: 0,
          nodes: [],
          links: [],
          groups: [],
          config: {},
          extra: {},
          version: 0.4
        }
      })),
      threads: this.threadsList,
      transcripts: this.transcripts
    })
    await chats.route(this.page)
    const runMode: AgentRunMode = { mode: 'ask_approval', credit_limit: null }
    await this.page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    await this.page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await this.page.route('**/api/agent/skills', (route) =>
      route.fulfill(jsonRoute(SKILLS))
    )
    await this.page.route('**/api/internal/cloud_analytics', (route) =>
      route.fulfill({ status: 204 })
    )
    await this.page.route('**/api/agent/threads/*/messages', (route) =>
      this.handleMessages(route)
    )
  }

  private async handleMessages(route: Route): Promise<void> {
    const request = route.request()
    const threadId = new URL(request.url()).pathname.split('/')[4]
    if (request.method() === 'POST') return this.acceptMessage(route, threadId)
    if (request.method() !== 'GET') return route.fallback()
    await this.readMessages(route, threadId)
  }

  private allocateNewThreadId(): string {
    if (this.blankMode) {
      const seeded = THREADS[this.createdThreads++]
      if (seeded) return seeded
    }
    return `00000000-0000-4000-8000-${String(++this.createdThreads).padStart(12, '0')}`
  }

  private async acceptMessage(
    route: Route,
    requestedThreadId: string
  ): Promise<void> {
    const body = zAgentPostMessageRequest.parse(route.request().postDataJSON())
    const threadId =
      requestedThreadId === 'new'
        ? this.allocateNewThreadId()
        : requestedThreadId
    this.posted.push({ requestedThreadId, threadId, body })
    const messageId = `${threadId}-accepted-${this.posted.length}`
    const turnId = `server-turn-${this.posted.length}`
    const existing = this.transcripts[threadId] ?? []
    if (requestedThreadId === 'new')
      this.threadsList.push(
        agentThreadSummary(threadId, body.content, {
          workflow_id: body.workflow_id ?? '',
          preview: body.content
        })
      )
    this.transcripts[threadId] = [
      ...existing,
      {
        id: `user-${messageId}`,
        thread_id: threadId,
        turn_id: turnId,
        role: 'user',
        status: 'complete',
        seq: existing.length + 1,
        workflow_id: body.workflow_id,
        content: {
          text: body.content,
          ...(body.client_message_id
            ? { client_message_id: body.client_message_id }
            : {})
        }
      },
      {
        id: messageId,
        thread_id: threadId,
        turn_id: turnId,
        role: 'assistant',
        status: 'streaming',
        seq: existing.length + 2,
        workflow_id: body.workflow_id,
        content: { text: '' }
      }
    ]
    const accepted: AgentTurnAccepted = {
      message_id: messageId,
      thread_id: threadId,
      workflow_id: body.workflow_id
    }
    await route.fulfill({ ...jsonRoute(accepted), status: 202 })
  }

  private async readMessages(route: Route, threadId: string): Promise<void> {
    const held = this.held?.threadId === threadId ? this.held : undefined
    if (held) {
      held.started = true
      held.entered.resolve()
    }
    await held?.release.promise
    try {
      await route.fulfill(
        held && held.status >= 400
          ? { status: held.status, json: { error: 'Transcript unavailable' } }
          : jsonRoute(this.transcripts[threadId] ?? [])
      )
      if (held) await (await route.request().response())?.finished()
    } finally {
      held?.settled.resolve()
    }
  }

  async openChat(index: number): Promise<void> {
    await this.panel.openChatFromHistory(`${WORKFLOWS[index].name} chat`)
    await expect(this.panel.userMessageBubbles).toHaveText([
      `${WORKFLOWS[index].name} existing request`
    ])
  }

  tab(index: number) {
    return this.topbar.getWorkflowTab(WORKFLOWS[index].name)
  }

  opening(index: number) {
    return this.panel.root.getByRole('status', {
      name: enMessages.agent.openingWorkflowChat.replace(
        '{workflowName}',
        WORKFLOWS[index].name
      ),
      exact: true
    })
  }

  working(index: number) {
    return this.tab(index).getByRole('img', {
      name: enMessages.g.agentWorking,
      exact: true
    })
  }

  updated(index: number) {
    return this.tab(index).getByRole('img', {
      name: enMessages.g.agentFinishedUnseen,
      exact: true
    })
  }

  holdMessages(index: number, status = 200) {
    const held = {
      threadId: THREADS[index],
      status,
      started: false,
      entered: deferred(),
      release: deferred(),
      settled: deferred()
    }
    this.held = held
    return {
      entered: held.entered.promise,
      release: async () => {
        held.release.resolve()
        await held.settled.promise
        if (this.held === held) this.held = undefined
        await nextFrame(this.page)
      }
    }
  }

  sendDelta(index: number, delta: string): void {
    const threadId = THREADS[index]
    const assistant = this.transcripts[threadId].findLast(
      (message) => message.role === 'assistant'
    )
    if (!assistant || !this.agentSocket)
      throw new Error('No accepted turn and connected fixture agent socket')
    const currentText =
      typeof assistant.content?.text === 'string' ? assistant.content.text : ''
    assistant.content = { ...assistant.content, text: `${currentText}${delta}` }
    const event: AgentWsEvent = {
      type: 'agent_message_delta',
      data: { message_id: assistant.id, thread_id: threadId, delta }
    }
    this.agentSocket.send(JSON.stringify(event))
  }

  setAssistantReply(index: number, text: string): void {
    const threadId = THREADS[index]
    const assistant = this.transcripts[threadId].findLast(
      (message) => message.role === 'assistant'
    )
    if (!assistant) throw new Error('No assistant row in fixture transcript')
    assistant.content = { ...assistant.content, text }
  }

  async holdNextGraphLoad() {
    await this.page.evaluate(() => {
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      const gate: NonNullable<typeof window.__heldGraphLoad> = {
        reached: false,
        release,
        abortedLoads: []
      }
      window.__heldGraphLoad = gate
      let holdNext = true
      window.app!.registerExtension({
        name: 'e2e.holdSwitchInsideBeforeLoadGraph',
        beforeLoadGraph: async () => {
          if (!holdNext) return
          holdNext = false
          gate.reached = true
          await held
        },
        onGraphLoadError: (error) => {
          gate.abortedLoads.push((error as Error).name)
        }
      })
    })
    this.graphLoadHeld = true
    return {
      reached: async () => {
        await this.page.waitForFunction(
          () => window.__heldGraphLoad?.reached === true
        )
      },
      release: () => this.releaseGraphLoad(),
      abortedLoads: () =>
        this.page.evaluate(() => window.__heldGraphLoad!.abortedLoads)
    }
  }

  private async releaseGraphLoad(): Promise<void> {
    if (!this.graphLoadHeld) return
    this.graphLoadHeld = false
    await this.page.evaluate(() => window.__heldGraphLoad?.release())
  }

  complete(index: number): void {
    const threadId = THREADS[index]
    const assistant = this.transcripts[threadId].findLast(
      (message) => message.role === 'assistant'
    )
    if (!assistant || !this.agentSocket)
      throw new Error('No accepted turn and connected fixture agent socket')
    assistant.status = 'complete'
    const event: AgentWsEvent = {
      type: 'agent_message_done',
      data: { message_id: assistant.id, thread_id: threadId }
    }
    this.agentSocket.send(JSON.stringify(event))
  }

  async dispose(): Promise<void> {
    await this.releaseGraphLoad()
    const held = this.held
    held?.release.resolve()
    if (held?.started) await held.settled.promise
  }
}

async function withTabChatTransitions(
  page: Page,
  agentFlagEnabled: boolean,
  blankMode: boolean,
  setup: (fixture: TabChatTransitions) => Promise<void>,
  use: (fixture: TabChatTransitions) => Promise<void>
): Promise<void> {
  const fixture = new TabChatTransitions(page, blankMode)
  await fixture.install()
  try {
    await bootAgentApp(page, agentFlagEnabled, {
      features: {
        posthog_config: {
          advanced_disable_flags: true,
          bootstrap: {
            featureFlags: {
              'agent-in-app-experience': true,
              'agent-skill-packs': true
            }
          }
        }
      },
      beforeNavigate: () => fixture.routeChats()
    })
    await fixture.panel.open()
    await setup(fixture)
    await use(fixture)
    expect(fixture.unexpectedMutations).toEqual([])
  } finally {
    await fixture.dispose()
  }
}

export const tabChatTransitionsTest = agentTest.extend<{
  tabChats: TabChatTransitions
  blankTabChats: TabChatTransitions
}>({
  tabChats: async ({ page, agentFlagEnabled }, use) => {
    await withTabChatTransitions(
      page,
      agentFlagEnabled,
      false,
      async (fixture) => {
        await fixture.openChat(1)
        await fixture.openChat(2)
        await fixture.openChat(0)
      },
      use
    )
  },
  blankTabChats: async ({ page, agentFlagEnabled }, use) => {
    await withTabChatTransitions(
      page,
      agentFlagEnabled,
      true,
      async (fixture) => {
        const workflowsTab = new WorkflowsSidebarTab(page)
        await workflowsTab.open()
        await workflowsTab.getPersistedItem(WORKFLOWS[0].name).click()
        await expect(fixture.tab(0)).toBeVisible()
        await workflowsTab.getPersistedItem(WORKFLOWS[1].name).click()
        await expect(fixture.tab(1)).toBeVisible()
        await workflowsTab.close()
        await fixture.tab(0).click()
        await expect(
          fixture.tab(0).and(fixture.topbar.getActiveTab())
        ).toBeVisible()
      },
      use
    )
  }
})
