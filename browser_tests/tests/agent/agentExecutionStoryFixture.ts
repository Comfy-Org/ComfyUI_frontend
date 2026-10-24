import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { AgentCancelAccepted } from '@comfyorg/ingest-types'

import type { JobDetail } from '@/platform/remote/comfyui/jobs/jobTypes'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import type { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentExecutionHelper } from '@e2e/fixtures/helpers/AgentExecutionHelper'
import { AssetsHelper } from '@e2e/fixtures/helpers/AssetsHelper'
import { AgentMultiAutogrowRealignHarness } from '@e2e/fixtures/helpers/AgentMultiAutogrowRealignHarness'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  MESSAGE_ID,
  THREAD_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const JOB_CANCEL_ROUTE_PATTERN =
  /\/api\/(?:interrupt|jobs\/(?:[^/]+\/)?cancel)$/

/**
 * `AgentExecutionHelper` plus the two surfaces only these user-story specs
 * need, kept here rather than pushed into the shared helper: a recorder for
 * job interrupt/cancel requests (so "the agent's turn stopped and the job did
 * not" is observable as the *absence* of a cancel), and a per-job
 * `GET /api/jobs/{id}` detail route.
 *
 * Registered after `super.install()`, which is what makes these routes win —
 * Playwright runs the most-recently-registered matching handler first — and
 * the same reason the base helper installs after the harness.
 */
class AgentExecutionStoryHelper extends AgentExecutionHelper {
  private readonly jobCancels: string[] = []
  private readonly storyPage: Page
  private readonly storyAssets: AssetsHelper

  constructor(page: Page, hostSocket: AgentFollowerHostSocket) {
    super(page, hostSocket)
    this.storyPage = page
    this.storyAssets = new AssetsHelper(page)
  }

  override async install(): Promise<void> {
    await super.install()
    await this.storyPage.route(JOB_CANCEL_ROUTE_PATTERN, (route) => {
      this.jobCancels.push(new URL(route.request().url()).pathname)
      return route.fulfill({ status: 200, body: '' })
    })
  }

  /** Paths of job interrupt or cancel requests, in request order. */
  jobCancelRequests(): readonly string[] {
    return this.jobCancels
  }

  /**
   * Serves `GET /api/jobs/{jobId}` — the detail record, which is separate from
   * the list row `enqueueServerRun` and `upsertJob` maintain. Its `workflow`
   * field is the body that was POSTed to `/api/prompt`, stored verbatim
   * (cloud `services/ingest/.../prompt.go`, `SetWorkflowJSON`), and it is the
   * only thing the "open as workflow" action has to rebuild a graph from.
   * Without this route that fetch 404s, so a spec about what the action does
   * with the detail must supply one rather than read a failed fetch as a
   * product verdict.
   */
  async mockJobDetail(jobId: string, detail: JobDetail): Promise<void> {
    await this.storyAssets.mockJobDetail(jobId, detail)
  }
}

interface AgentExecutionStoryRig {
  harness: AgentMultiAutogrowRealignHarness
  execution: AgentExecutionStoryHelper
}

/**
 * The execution rig of `agentExecutionFixture`, but with no turn sent yet:
 * the harness's message mock serves exactly one `message_id`, so a user-story
 * spec whose subject IS a turn — "run it", or stopping one mid-flight — must
 * drive that turn itself rather than spend the only one on a binding
 * handshake. The panel is open and targeting the workflow; sending the
 * story's message is what acks the turn and binds the CRDT follower.
 */
export const agentExecutionStoryTest = agentTest.extend<{
  rig: AgentExecutionStoryRig
}>({
  rig: async ({ page }, use) => {
    const harness = new AgentMultiAutogrowRealignHarness(page)
    await harness.setUp({ settings: { 'Comfy.Queue.QPOV2': false } })
    const execution = new AgentExecutionStoryHelper(page, harness.hostSocket)
    await execution.install()
    const accepted: AgentCancelAccepted = { status: 'cancelling' }
    await page.route('**/api/agent/threads/*/messages/*/cancel', (route) =>
      route.fulfill({ ...jsonRoute(accepted), status: 202 })
    )
    await harness.targetActiveWorkflow()
    await use({ harness, execution })
  }
})

/**
 * Sends the story's user message and waits until the turn is live: the
 * assistant placeholder is rendered (`agent_message_done` is only routed while
 * the store holds the ack's `message_id`), the turn's ack has bound the CRDT
 * follower, and the workflow the agent would run is visible on the canvas.
 */
export async function startStoryTurn(
  harness: AgentMultiAutogrowRealignHarness,
  text: string
): Promise<void> {
  // `harness.agentPanel.composer`, not a hand-rolled locator: the composer's
  // accessible name is the `agent.placeholder` /
  // `agent.placeholderWithoutSkills` pair, and `AGENT_COMPOSER_LABEL` tracks
  // both. A literal here silently matches nothing and the fill times out.
  await harness.agentPanel.composer.fill(text)
  await harness.panel
    .getByRole('button', { name: enMessages.agent.send })
    .click()
  await expect(
    harness.panel.getByText(enMessages.agent.thinking).first()
  ).toBeVisible()
  await harness.hostSocket.waitForSubscribe()
  await expect(harness.targetNode).toBeVisible()
}

/** Ends the live turn from the host and waits for the panel to go idle. */
export async function settleStoryTurn(
  harness: AgentMultiAutogrowRealignHarness
): Promise<void> {
  harness.hostSocket.send({
    type: 'agent_message_done',
    data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
  })
  await expect(
    harness.panel.getByRole('button', { name: enMessages.agent.stop })
  ).toHaveCount(0)
}

/** The agent's `run` tool call frame, `running` or settled. */
export function runToolCallFrame(status: 'running' | 'success') {
  return {
    type: 'agent_tool_call' as const,
    data: {
      tool_call_id: 'call-run',
      tool_name: 'run',
      status,
      ...(status === 'success' && { duration_ms: 1200 }),
      message_id: MESSAGE_ID,
      thread_id: THREAD_ID
    }
  }
}
