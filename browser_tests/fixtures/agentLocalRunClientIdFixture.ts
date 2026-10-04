import type { Locator, Page } from '@playwright/test'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { AgentExecutionHelper } from '@e2e/fixtures/helpers/AgentExecutionHelper'
import { MultiAutogrowRealignHarness } from '@e2e/fixtures/helpers/MultiAutogrowRealignHarness'
import {
  SOCKET_SID,
  SOURCE_NODE_ID,
  TARGET_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

/**
 * A client id this tab must never put on the wire: one left in
 * `sessionStorage` by an earlier session of this tab, which a duplicated tab
 * also inherits verbatim. `api.initialClientId` exposes exactly this value and
 * `useWorkflowTabState.getClientId()` falls back to it, so reaching for it here
 * would read as a tidy reuse — while addressing a local agent run to a socket
 * that is dead or belongs to another tab.
 */
export const STALE_SESSION_CLIENT_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

/** The turn POST body as the server receives it. */
export type TurnPostBody = Record<string, unknown>

export interface AgentLocalRunRig {
  harness: MultiAutogrowRealignHarness
  /** Every turn POST body the panel has sent, oldest first. */
  turnPosts: () => readonly TurnPostBody[]
  /**
   * `client_id` on the newest turn POST, or `undefined` when the key was
   * absent — which is what `withoutUndefined` produces for a socket that has
   * not identified itself.
   */
  lastTurnClientId: () => unknown
  /**
   * Starts a run the way the agent's `run` tool does on a local setup —
   * server-side through comfy-cli, never through this browser — and leaves it
   * pinned mid-execution so the live highlight is observable rather than
   * already retired by a terminal frame.
   *
   * The job's HTTP surface always advances, because `/api/jobs` and
   * `/api/view` do not know who submitted. The execution frames are addressed
   * to the socket whose `client_id` the turn carried, as ComfyUI addresses
   * them.
   */
  startRunForUser: (jobId: string) => Promise<void>
  /** Finishes that run with one image output on the output node. */
  finishRunForUser: (jobId: string) => Promise<void>
  /** {@link startRunForUser} then {@link finishRunForUser}. */
  runWorkflowForUser: (jobId: string) => Promise<void>
  /** The executing class on the running node root, independent of selection. */
  runningOutline: Locator
  /** The run's output as rendered on the output node. */
  outputImage: Locator
  /** `filename` the completed run's output is served under. */
  outputFilename: (jobId: string) => string
}

interface AgentLocalRunOptions {
  /**
   * Whether the fake ComfyUI identifies its socket on the `status` frame.
   * `false` models the window before the first `status` arrives:
   * `api.clientId` is undefined while the in-memory `api.initialClientId`
   * snapshot can still contain an id inherited from an earlier session.
   */
  socketReportsId: boolean
}

async function recordTurnPosts(
  page: Page,
  into: TurnPostBody[]
): Promise<void> {
  // Registered after the harness's own handler so this one runs first
  // (Playwright runs the most-recently-registered match first), then falls
  // back to it — the harness still answers the POST, this only observes it.
  await page.route('**/api/agent/threads/*/messages', (route) => {
    if (route.request().method() === 'POST') {
      into.push(route.request().postDataJSON() as TurnPostBody)
    }
    return route.fallback()
  })
}

const outputFilename = (jobId: string) => `${jobId}.png`

/**
 * The agent harness, its execution surface, and the turn POST bodies the panel
 * sent — the three things PM-1875 needs read together. A local agent run is
 * submitted by comfy-cli, not by this browser, and ComfyUI delivers a prompt's
 * execution events only to the socket whose `client_id` submitted it, so
 * whether the canvas can follow the run is decided entirely by what this tab
 * put in that POST body.
 */
export const agentLocalRunTest = agentTest.extend<
  AgentLocalRunOptions & { rig: AgentLocalRunRig }
>({
  socketReportsId: [true, { option: true }],
  rig: async ({ page, socketReportsId }, use) => {
    if (!socketReportsId) {
      await page.addInitScript(
        (staleId) => sessionStorage.setItem('clientId', staleId),
        STALE_SESSION_CLIENT_ID
      )
    }

    const harness = new MultiAutogrowRealignHarness(page, {
      socketSid: socketReportsId ? SOCKET_SID : ''
    })
    await harness.setUp({ settings: { 'Comfy.Queue.QPOV2': false } })

    const turnPosts: TurnPostBody[] = []
    await recordTurnPosts(page, turnPosts)

    const execution = new AgentExecutionHelper(page, harness.hostSocket)
    await execution.install()
    const lastTurnClientId = () => turnPosts.at(-1)?.['client_id']
    execution.addressFramesWhen(() => lastTurnClientId() === SOCKET_SID)

    if (socketReportsId) {
      await page.waitForFunction(
        (expectedSid) => sessionStorage.getItem('clientId') === expectedSid,
        SOCKET_SID
      )
    }

    await harness.bindAndAwaitFirstTurn()

    const startRunForUser = async (jobId: string) => {
      await execution.enqueueServerRun(jobId)
      await execution.stallJob(jobId, { nodeId: TARGET_ID })
    }
    const finishRunForUser = (jobId: string) =>
      execution.completeJob(jobId, {
        nodeId: String(SOURCE_NODE_ID),
        filename: outputFilename(jobId)
      })

    await use({
      harness,
      turnPosts: () => turnPosts,
      lastTurnClientId,
      startRunForUser,
      finishRunForUser,
      runWorkflowForUser: async (jobId: string) => {
        await startRunForUser(jobId)
        await finishRunForUser(jobId)
      },
      runningOutline: harness.targetNode.locator(
        ':scope.outline-node-stroke-executing'
      ),
      outputImage: harness.outputImage(SOURCE_NODE_ID),
      outputFilename
    })
  }
})
