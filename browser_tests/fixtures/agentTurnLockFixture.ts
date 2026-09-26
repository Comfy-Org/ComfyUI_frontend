import { expect, mergeTests } from '@playwright/test'
import type { Locator, Page, WebSocketRoute } from '@playwright/test'

import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentError,
  AgentMessage,
  AgentTurnAccepted
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

const zAnswerRequest = z.object({ selected: z.array(z.string()) })

const THREAD_ID = 'b9d0a2a1-0f2c-4f1a-9a5e-6b0f4f2c1d77'
const TURN_ID = '2dd4f367-3399-4cb4-8127-547f531c289a'
const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-000000000001'

/**
 * Verbatim from `services/agent/server/agent_handler.go`, which answers a post
 * to a thread whose assistant row is still `streaming` with HTTP 409 and this
 * body. The client renders it as `agent.sendFailed` + ': ' + this text.
 */
export const TURN_IN_PROGRESS_MESSAGE =
  'a turn is already in progress for this thread'

const TURN_IN_PROGRESS: AgentError = { error: TURN_IN_PROGRESS_MESSAGE }

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

export const TURN_DONE_EVENT: AgentWsEvent = {
  type: 'agent_message_done',
  data: { message_id: TURN_ID, thread_id: THREAD_ID }
}

const RUN_APPROVAL_ASK_ID = `${TURN_ID}:call-run-workflow`

/**
 * The frame the server sends when a turn parks waiting for the user to approve
 * a run. Shaped after `pendingRunApproval`'s reader and cloud's `asks` writer:
 * the turn does not proceed until an answer posts back, so a client that drops
 * this frame strands the user with no way to answer and no error.
 */
export const RUN_APPROVAL_EVENT: AgentWsEvent = {
  type: 'agent_ask',
  data: {
    message_id: TURN_ID,
    thread_id: THREAD_ID,
    ask_id: RUN_APPROVAL_ASK_ID,
    kind: 'run_approval',
    prompt: 'Run workflow “Unsaved Workflow”?',
    context: { workflow_id: WORKFLOW_ID, workflow_name: 'Unsaved Workflow' },
    options: [
      { id: 'run', label: enMessages.agent.runApproval.run },
      { id: 'cancel', label: enMessages.agent.runApproval.cancel }
    ],
    min_selections: 1,
    max_selections: 1,
    allow_other: false
  }
}

/**
 * The server's half of a turn, modelled on the real single-active-turn guard:
 * an assistant row goes `streaming` when a turn starts and only leaves that
 * state when the turn completes, fails, or is cancelled. Dropping the client's
 * socket does not touch it — that asymmetry is what these specs exercise.
 *
 * `transcript()` and the cancel route are not reached by the current specs.
 * They are here so the fake stays a faithful server: a repair that re-hydrates
 * on reconnect, or a spec that clicks Stop, needs both, and a half-modelled
 * server would make such a fix look broken.
 */
class TurnLockServer {
  private streaming = false
  private prompt = ''
  private rejected = 0
  private posts = 0
  private readonly answered: string[][] = []

  get turnIsStreaming(): boolean {
    return this.streaming
  }

  get rejectedPosts(): number {
    return this.rejected
  }

  /** Every post the server answered, accepted or rejected. */
  get postAttempts(): number {
    return this.posts
  }

  countPost(): void {
    this.posts++
  }

  /** Every ask answer the server accepted, in order, as the selected ids. */
  get answers(): string[][] {
    return this.answered
  }

  recordAnswer(selected: string[]): void {
    this.answered.push(selected)
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
    server.countPost()
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

  await page.route('**/api/agent/threads/*/asks/*/answer', (route) => {
    const body: unknown = route.request().postDataJSON()
    const selected = zAnswerRequest.parse(body).selected
    server.recordAnswer(selected)
    const accepted: AgentAnswerAccepted = { status: 'answered' }
    return route.fulfill(jsonRoute(accepted))
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
  private readonly agentPanel: AgentPanel

  constructor(
    private readonly page: Page,
    private readonly server: TurnLockServer,
    private readonly finishSave: (success: boolean) => void,
    private readonly savedPaths: () => number,
    private readonly getWebSocket: () => Promise<WebSocketRoute>,
    private readonly nextWebSocket: () => Promise<WebSocketRoute>
  ) {
    this.agentPanel = new AgentPanel(page)
    this.panel = this.agentPanel.root
    this.composer = this.panel.getByRole('textbox')
    this.sendButton = this.panel.getByRole('button', {
      name: enMessages.agent.send,
      exact: true
    })
    this.stopButton = this.panel.getByRole('button', {
      name: enMessages.agent.stop,
      exact: true
    })
    // WorkSummary.vue renders three labels off the elapsed total: `worked`
    // alone, `workedForSeconds`, or `workedForMinutes`. Anchoring on the
    // shared `worked` stem matches all three, so the negative assertions on
    // this locator cannot go vacuous when a turn is shorter or longer than the
    // fixture's tool duration, or when the copy is reworded.
    this.workSummary = this.panel.getByRole('button', {
      name: new RegExp(
        `^${enMessages.agent.worked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
      )
    })
    this.workingRow = this.panel.getByText(enMessages.agent.working, {
      exact: true
    })
    this.userBubbles = this.panel.getByTestId('user-message-bubble')
  }

  rejectedPosts(): number {
    return this.server.rejectedPosts
  }

  postAttempts(): number {
    return this.server.postAttempts
  }

  /** Opens the panel on a blank workflow and points the composer at that tab. */
  async openOnBlankWorkflow(): Promise<void> {
    await expect(
      this.page.getByTestId(TestIds.topbar.integratedTabBarActions)
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 15_000 })
    await this.agentPanel.open()
    await this.page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await expect(this.panel).toBeVisible()
    // Not AgentPanel.selectWorkflow(): it asserts the picker label straight
    // after the menu click, but under this fixture the label only settles once
    // the pending workflow save is released below.
    await this.agentPanel.workflowPicker.click()
    await this.page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect.poll(() => this.savedPaths()).toBe(1)
    this.finishSave(true)
    await expect(this.agentPanel.workflowPicker).toHaveText('Unsaved Workflow')
  }

  /** Sends a prompt and streams it to the point where a user sees work happening. */
  async startTurn(prompt: string): Promise<void> {
    const live = await this.getWebSocket()
    await this.composer.fill(prompt)
    await this.sendButton.click()
    // Stop is NOT an ack: Composer renders it from `isSending`, which
    // useAgentSession sets before the POST (and before a prepare() race worth
    // up to PREPARE_TIMEOUT_MS). The user bubble comes from recordUser(), one
    // line above startTurn(), so it is the first signal that activeTurnId is
    // set. Pushing a frame before that point gets it silently dropped by
    // agentConversationStore.ingest, with no retry.
    await expect(this.userBubbles).toHaveText([prompt])
    this.push(live, TURN_THINKING_EVENT)
    await expect(this.panel.getByText(TURN_THINKING_TEXT)).toBeVisible()
    this.push(live, TURN_TOOL_EVENT)
    await expect(this.workingRow).toBeVisible()
  }

  push(ws: WebSocketRoute, event: AgentWsEvent): void {
    ws.send(JSON.stringify(event))
  }

  /**
   * Replays the Web Audio work an audio preview does while a turn is live:
   * open an AudioContext, `decodeAudioData` real WAV bytes, close it. This is
   * the shape of `useWaveAudioPlayer.decodeAudioSource`, not a call into it —
   * the product's `api.fetchApi` step and its waveform pass are not exercised,
   * so this shows Web Audio alone is harmless rather than clearing the whole
   * player.
   */
  async decodeAudioLikeAPreview(): Promise<void> {
    await this.page.evaluate(async () => {
      const frames = 800
      const bytes = new ArrayBuffer(44 + frames * 2)
      const view = new DataView(bytes)
      const ascii = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i++)
          view.setUint8(offset + i, text.charCodeAt(i))
      }
      ascii(0, 'RIFF')
      view.setUint32(4, 36 + frames * 2, true)
      ascii(8, 'WAVEfmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, 1, true)
      view.setUint32(24, 8000, true)
      view.setUint32(28, 16000, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      ascii(36, 'data')
      view.setUint32(40, frames * 2, true)

      const context = new AudioContext()
      await context.decodeAudioData(bytes)
      await context.close()
    })
  }

  /**
   * Every ask the user answered through the panel, flattened to the selected
   * option ids. Reads the fake server rather than the DOM, so it proves the
   * answer actually left the client.
   */
  answeredAsks(): string[] {
    return this.server.answers.flat()
  }

  /** The socket the client is currently on, with no drop. */
  async liveSocket(): Promise<WebSocketRoute> {
    return this.getWebSocket()
  }

  /** Drops the live socket and resolves with the one the client reconnects on. */
  async dropSocket(): Promise<WebSocketRoute> {
    // Resolve the live route first: with no socket open yet both calls would
    // queue on the same waiter and hand back the same route, so the close
    // below would kill the one returned as the reconnect.
    const live = await this.getWebSocket()
    const reconnected = this.nextWebSocket()
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
