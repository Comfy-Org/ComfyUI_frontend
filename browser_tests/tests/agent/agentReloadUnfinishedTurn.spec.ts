import { expect } from '@playwright/test'

import type { AgentMessage } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import {
  openAgentPanel,
  reopenAfterReload,
  sendTurn
} from '@e2e/fixtures/helpers/agentAttachmentRehydration'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Leaving while the agent is still generating is the one reload that reads
 * back an assistant row the service has not finished writing. `hydrate()`
 * builds a transport only for a row parked on an ask, so a row merely marked
 * `streaming` has nothing that could ever settle it — presenting it as live
 * spins a reply forever while the composer, which reads the active slot
 * instead of the message, stays enabled beside it.
 *
 * The other reload specs all serve `complete` rows, which is why this shape
 * needs its own case.
 */
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'a turn still unfinished on the server settles rather than spins after a reload',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    const serverTurnId = 'e2e-unfinished-turn'

    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const threadId = new URL(route.request().url()).pathname
        .split('/')
        .at(-2)!
      const posted = promptHistory.requests.at(0)
      if (!posted) return route.fallback()
      const messages: AgentMessage[] = [
        {
          id: 'e2e-unfinished-user',
          thread_id: threadId,
          turn_id: serverTurnId,
          seq: 1,
          role: 'user',
          status: 'complete',
          content: { text: posted.content }
        },
        {
          id: serverTurnId,
          thread_id: threadId,
          turn_id: serverTurnId,
          seq: 2,
          role: 'assistant',
          status: 'streaming',
          content: { text: 'Working on it' }
        }
      ]
      return route.fulfill(jsonRoute(messages))
    })

    const panel = await openAgentPanel(page, workflowSelection)
    await sendTurn(panel, 'upscale this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const reopened = await reopenAfterReload(panel, page)

    await expect(reopened.getByText('Working on it')).toBeVisible({
      timeout: 10_000
    })
    await expect(reopened.getByText(enMessages.agent.working)).toHaveCount(0)
    // The composer and the transcript have to agree: a panel offering Send is
    // not one with a turn in flight.
    await expect(
      reopened.getByRole('button', { name: enMessages.agent.stop, exact: true })
    ).toHaveCount(0)
    await expect(
      reopened.getByRole('button', { name: enMessages.agent.send, exact: true })
    ).toBeVisible()
  }
)
