import { expect, mergeTests } from '@playwright/test'
import type { Locator, Page, WebSocketRoute } from '@playwright/test'

import type {
  AgentCancelAccepted,
  AgentError,
  AgentMessage,
  AgentTurnAccepted
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

const THREAD_ID = 'b9d0a2a1-0f2c-4f1a-9a5e-6b0f4f2c1d77'
const TURN_ID = '2dd4f367-3399-4cb4-8127-547f531c289a'
const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-000000000001'

/**
 * Verbatim from `services/agent/server/agent_handler.go`, which answers a post
 * to a thread whose assistant row is still `streaming` with HTTP 409 and this
 * body. The client renders it as `agent.sendFailed` + ': ' + this text.
 */
const TURN_IN_PROGRESS: AgentError = {
  error: 'a turn is already in progress for this thread'
}

const TURN_THINKING_TEXT = 'Wiring the audio output node.'
export const POST_RECONNECT_TEXT = 'Reconnected, and the graph is ready.'

const TURN_THINKING_EVENT: AgentWsEvent = {
  type: 'agent_thinking',
  data: { delta: TURN_THINKING_TEXT, message_id: TURN_ID, thread_id: THREAD_ID }
}

const TURN_TOOL_EVENT: AgentWsEvent = {
  type: 'agent_tool_call',
  data: {
    tool_call_id: 'call-add-node',
    tool_name: 'add_node',
    status: 'success',
    duration_ms: 1300,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const POST_RECONNECT_EVENT: AgentWsEvent = {
  type: 'agent_message_delta',
  data: {
    delta: POST_RECONNECT_TEXT,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

/**
 * The server's half of a turn, modelled on the real single-active-turn guard:
 * an assistant row goes `streaming` when a turn starts and only leaves that
 * state when the turn completes, fails, or is cancelled. Dropping the client's
 * socket does not touch it — that asymmetry is what these specs exercise.
 */
class TurnLockServer {
  private streaming = false
  private prompt = ''
  private rejected = 0

  get turnIsStreaming(): boolean {
    return this.streaming
  }

  get rejectedPosts(): number {
    return this.rejected
  }

  completeTurn(): void {
    this.streaming = false
  }

  transcript(): AgentMessage[] {
    return [
      {
        id: 'user-1',
        thread_id: THREAD_ID,
        turn_id: TURN_ID,
        seq: 1,
        role: 'user',
        status: 'complete',
        workflow_id: WORKFLOW_ID,
        content: { text: this.prompt }
      },
      {
        id: TURN_ID,
        thread_id: THREAD_ID,
        turn_id: TURN_ID,
        seq: 2,
        role: 'assistant',
        status: this.streaming ? 'streaming' : 'complete',
        workflow_id: WORKFLOW_ID
      }
    ]
  }

  startTurn(prompt: string): AgentTurnAccepted {
    this.prompt = prompt
    this.streaming = true
    return { message_id: TURN_ID, thread_id: THREAD_ID }
  }

  rejectPost(): AgentError {
    this.rejected++
    return TURN_IN_PROGRESS
  }
}

async function routeTurnLock(
  page: Page,
  server: TurnLockServer
): Promise<void> {
  await page.route('**/api/agent/threads/*/messages', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill(jsonRoute(server.transcript()))
    if (server.turnIsStreaming)
      return route.fulfill({ ...jsonRoute(server.rejectPost()), status: 409 })
    const request = zAgentPostMessageRequest.parse(
      route.request().postDataJSON()
    )
    return route.fulfill({
      ...jsonRoute(server.startTurn(request.content)),
      status: 202
    })
  })

  await page.route('**/api/agent/threads/*/messages/*/cancel', (route) => {
    server.completeTurn()
    const accepted: AgentCancelAccepted = { status: 'cancelling' }
    return route.fulfill(jsonRoute(accepted))
  })
}

export class AgentTurnLockHarness {
  public readonly panel: Locator
  public readonly composer: Locator
  public readonly sendButton: Locator
  public readonly stopButton: Locator
  public readonly workSummary: Locator
  public readonly workingRow: Locator
  public readonly userBubbles: Locator

  constructor(
    private readonly page: Page,
    private readonly server: TurnLockServer,
    private readonly finishSave: (success: boolean) => void,
    private readonly savedPaths: () => number,
    private readonly getWebSocket: () => Promise<WebSocketRoute>,
    private readonly nextWebSocket: () => Promise<WebSocketRoute>
  ) {
    this.panel = page.locator('#agent-panel-root')
    this.composer = this.panel.getByRole('textbox')
    this.sendButton = this.panel.getByRole('button', {
      name: enMessages.agent.send,
      exact: true
    })
    this.stopButton = this.panel.getByRole('button', {
      name: enMessages.agent.stop,
      exact: true
    })
    this.workSummary = this.panel.getByRole('button', { name: /^Worked for / })
    this.workingRow = this.panel.getByText(enMessages.agent.working, {
      exact: true
    })
    this.userBubbles = this.panel.getByTestId('user-message-bubble')
  }

  rejectedPosts(): number {
    return this.server.rejectedPosts
  }

  /** Opens the panel on a blank workflow and points the composer at that tab. */
  async openOnBlankWorkflow(): Promise<void> {
    await expect(
      this.page.getByTestId('integrated-tab-bar-actions')
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 15_000 })
    await this.page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    await expect(this.panel).toBeVisible()
    await this.page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await expect(this.panel).toBeVisible()
    await this.panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await this.page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect.poll(() => this.savedPaths()).toBe(1)
    this.finishSave(true)
  }

  /** Sends a prompt and streams it to the point where a user sees work happening. */
  async startTurn(prompt: string): Promise<void> {
    const live = await this.getWebSocket()
    await this.composer.fill(prompt)
    await this.sendButton.click()
    await expect(this.stopButton).toBeVisible()
    this.push(live, TURN_THINKING_EVENT)
    await expect(this.panel.getByText(TURN_THINKING_TEXT)).toBeVisible()
    this.push(live, TURN_TOOL_EVENT)
    await expect(this.workingRow).toBeVisible()
  }

  push(ws: WebSocketRoute, event: AgentWsEvent): void {
    ws.send(JSON.stringify(event))
  }

  /** Drops the live socket and resolves with the one the client reconnects on. */
  async dropSocket(): Promise<WebSocketRoute> {
    const reconnected = this.nextWebSocket()
    const live = await this.getWebSocket()
    await live.close()
    return reconnected
  }
}

export const agentTurnLockTest = mergeTests(
  agentTest,
  workflowSelectionTest,
  webSocketFixture
).extend<{ turnLock: AgentTurnLockHarness }>({
  turnLock: async (
    { page, workflowSelection, getWebSocket, nextWebSocket },
    use
  ) => {
    // Workflow selection boots the app before these agent-specific routes.
    void workflowSelection
    const server = new TurnLockServer()
    await routeTurnLock(page, server)
    await use(
      new AgentTurnLockHarness(
        page,
        server,
        workflowSelection.finishSave,
        () => workflowSelection.savedPaths.length,
        getWebSocket,
        nextWebSocket
      )
    )
  }
})
