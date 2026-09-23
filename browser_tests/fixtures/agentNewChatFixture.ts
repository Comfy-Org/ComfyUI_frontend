import { expect } from '@playwright/test'
import type { Page, Response, Route } from '@playwright/test'
import type {
  AgentPostMessageRequest,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { zAgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentConversationTest } from '@e2e/fixtures/agentConversationFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const NEW_CHAT_THREAD_ID = '4b8e2c6a-1d3f-4e57-9a80-2c7d5e9f1b33'
const NEW_CHAT_TURN_ID = '9f1d3b5c-7a2e-4c68-8d41-6e0a2b4c8d55'
const FRESH_WORKFLOW_ID = 'c2d4e6f8-0a1b-4c3d-9e5f-7a8b9c0d1e2f'
const MESSAGES_PATH = /\/api\/agent\/threads\/([^/]+)\/messages$/

interface PostedTurn {
  threadId: string
  body: AgentPostMessageRequest
}

interface AcceptedThread {
  id: string
  title: string
  workflowId: string
}

function threadIdOf(url: string): string {
  const match = MESSAGES_PATH.exec(new URL(url).pathname)
  if (match === null)
    throw new Error(`Expected a thread messages URL, got ${url}`)
  return match[1]
}

function isTurnPost(response: Response): boolean {
  return (
    response.request().method() === 'POST' &&
    MESSAGES_PATH.test(new URL(response.url()).pathname)
  )
}

/**
 * The thread a turn's ack describes, or the reason the ack cannot be trusted
 * (not 2xx, or not a well-formed `AgentTurnAccepted` to a well-formed post).
 */
async function parseAck(response: Response): Promise<AcceptedThread | string> {
  if (!response.ok()) return `${response.status()} ${response.url()}`
  const accepted = zAgentTurnAccepted.safeParse(
    await response.json().catch(() => undefined)
  )
  const posted = zAgentPostMessageRequest.safeParse(
    response.request().postDataJSON()
  )
  if (!accepted.success) return `${response.url()}: ${accepted.error.message}`
  if (!posted.success) return `${response.url()}: ${posted.error.message}`
  // The ack names the workflow the turn ran against: the client's own when
  // it posted one, else the one the server minted for a fresh chat.
  return {
    id: accepted.data.thread_id,
    title: posted.data.content,
    workflowId: accepted.data.workflow_id ?? posted.data.workflow_id ?? ''
  }
}

/**
 * The server's half of a second chat started on the conversation harness.
 * Records every turn the panel posts; the first falls through to the
 * harness, which acks it against the recording's workflow, and the ones
 * after are acked the way the server does: the workflow the client named,
 * or a freshly minted one when it named none. Every acked thread is listed,
 * titled by its first prompt, so the history screen has a row to delete.
 * An ack that is not a 2xx `AgentTurnAccepted` is recorded as a failure
 * for the fixture to assert on instead of skewing the list.
 */
class AgentNewChatServer {
  private readonly posted: PostedTurn[] = []
  private readonly accepted: AcceptedThread[] = []
  private readonly ackFailures: string[] = []
  // `page.on('response')` does not await its listeners: an ack still being
  // read when the test ends would be missed by `failedAcks()`, so the
  // teardown settles these first.
  private readonly recordings: Promise<void>[] = []

  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    this.page.on('response', (response) => {
      this.recordings.push(this.recordAccepted(response))
    })
    await this.page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(this.threadList()))
    )
    await this.page.route('**/api/agent/threads/*/messages', (route) =>
      this.answerPost(route)
    )
  }

  postedTurns(): readonly PostedTurn[] {
    return this.posted
  }

  async failedAcks(): Promise<readonly string[]> {
    await Promise.all(this.recordings)
    return this.ackFailures
  }

  private async recordAccepted(response: Response): Promise<void> {
    if (!isTurnPost(response)) return
    const ack = await parseAck(response)
    if (typeof ack === 'string') this.ackFailures.push(ack)
    else this.accepted.push(ack)
  }

  private answerPost(route: Route): Promise<void> {
    const request = route.request()
    if (request.method() !== 'POST') return route.fallback()
    const turn: PostedTurn = {
      threadId: threadIdOf(request.url()),
      body: zAgentPostMessageRequest.parse(request.postDataJSON())
    }
    this.posted.push(turn)
    if (this.posted.length === 1) return route.fallback()
    const accepted: AgentTurnAccepted = {
      thread_id: NEW_CHAT_THREAD_ID,
      message_id: NEW_CHAT_TURN_ID,
      workflow_id: turn.body.workflow_id ?? FRESH_WORKFLOW_ID
    }
    return route.fulfill({ ...jsonRoute(accepted), status: 202 })
  }

  private threadList(): AgentThreadListResponse {
    return {
      threads: this.accepted.map(({ id, title, workflowId }) => ({
        id,
        title,
        preview: title,
        workflow_id: workflowId,
        status: 'active',
        message_count: 2,
        created_at: '2026-09-18T10:00:00Z',
        updated_at: '2026-09-18T10:00:00Z',
        last_message_at: '2026-09-18T10:00:00Z'
      })),
      pagination: {
        offset: 0,
        limit: 100,
        total: this.accepted.length,
        has_more: false
      }
    }
  }
}

// Depends on `agentConversation` so these routes register after the
// harness's and answer first.
export const agentNewChatTest = agentConversationTest.extend<{
  newChat: AgentNewChatServer
}>({
  newChat: async ({ page, agentConversation: _harness }, use) => {
    const server = new AgentNewChatServer(page)
    await server.install()
    await use(server)
    expect(await server.failedAcks()).toEqual([])
  }
})
