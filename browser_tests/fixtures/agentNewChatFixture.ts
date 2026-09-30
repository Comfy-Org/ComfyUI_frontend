import { expect } from '@playwright/test'
import type { Page, Request, Response, Route } from '@playwright/test'
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

function tryPostDataJson(request: Request): unknown {
  try {
    return request.postDataJSON()
  } catch {
    return undefined
  }
}

async function readAck(
  response: Response
): Promise<{ thread: AcceptedThread } | { failure: string }> {
  const accepted = zAgentTurnAccepted.safeParse(
    await response.json().catch(() => undefined)
  )
  // postDataJSON() throws on a non-JSON body, inside an unawaited listener.
  const posted = zAgentPostMessageRequest.safeParse(
    tryPostDataJson(response.request())
  )
  if (!accepted.success || !posted.success)
    return {
      failure: `${response.url()}: ${(accepted.error ?? posted.error)?.message}`
    }
  return {
    thread: {
      id: accepted.data.thread_id,
      title: posted.data.content,
      workflowId: accepted.data.workflow_id ?? posted.data.workflow_id ?? ''
    }
  }
}

function threadIdOf(url: string): string {
  const match = MESSAGES_PATH.exec(new URL(url).pathname)
  if (match === null)
    throw new Error(`Expected a thread messages URL, got ${url}`)
  return match[1]
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
  private readonly recording = new Set<Promise<void>>()

  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    this.page.on('response', (response) => {
      const record = this.recordAccepted(response)
      this.recording.add(record)
      void record.finally(() => this.recording.delete(record))
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

  failedAcks(): readonly string[] {
    return this.ackFailures
  }

  /** `response` fires on headers, so a body read can still be in flight. */
  async settled(): Promise<void> {
    while (this.recording.size > 0) await Promise.all([...this.recording])
  }

  private async recordAccepted(response: Response): Promise<void> {
    const request = response.request()
    if (
      request.method() !== 'POST' ||
      !MESSAGES_PATH.test(new URL(response.url()).pathname)
    )
      return
    if (!response.ok()) {
      this.ackFailures.push(`${response.status()} ${response.url()}`)
      return
    }
    const outcome = await readAck(response)
    if ('failure' in outcome) this.ackFailures.push(outcome.failure)
    else this.accepted.push(outcome.thread)
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
    await server.settled()
    expect(server.failedAcks()).toEqual([])
  }
})
