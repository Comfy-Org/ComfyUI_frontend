import type { BrowserContext, Locator, Page } from '@playwright/test'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { AgentExecutionHelper } from '@e2e/fixtures/helpers/AgentExecutionHelper'
import { AgentMultiAutogrowRealignHarness } from '@e2e/fixtures/helpers/AgentMultiAutogrowRealignHarness'
import { COMFY_SOCKET_SID } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  SOURCE_NODE_ID,
  TARGET_ID
} from '@e2e/fixtures/data/agent/agentCrdtMultiAutogrowRealignFixture'

/** A stale `sessionStorage` client id that must never reach the wire. */
export const STALE_SESSION_CLIENT_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const PEER_SOCKET_SID = '6c0e1d2f-3a4b-5c6d-7e8f-901a2b3c4d5e'

const turnPostBodySchema = zAgentPostMessageRequest.passthrough()
const QUEUE_REMAINING_ATTRIBUTE = 'data-agent-local-run-queue-remaining'

/** The turn POST body as the server receives it. */
type TurnPostBody = z.infer<typeof turnPostBodySchema>

export interface AgentLocalRunRig {
  page: Page
  harness: AgentMultiAutogrowRealignHarness
  /** Every turn POST body the panel has sent, oldest first. */
  turnPosts: () => readonly TurnPostBody[]
  /** `client_id` on the newest turn POST, or `undefined` when absent. */
  lastTurnClientId: () => string | undefined
  /** Starts a server-submitted run and leaves it pinned mid-execution. */
  startRunForUser: (jobId: string) => Promise<void>
  /** Waits two animation frames and a macrotask in the page. */
  settleExecutionFrames: () => Promise<void>
  /** Waits until this page has processed a `status` frame with this count. */
  waitForQueueRemaining: (count: number) => Promise<void>
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
  /** Opens a separately connected canvas whose run frames target this rig. */
  openPeer: () => Promise<AgentLocalRunRig>
}

interface AgentLocalRunOptions {
  socketReportsId: boolean
}

async function recordTurnPosts(
  page: Page,
  into: TurnPostBody[]
): Promise<void> {
  await page.route('**/api/agent/threads/*/messages', (route) => {
    if (route.request().method() === 'POST') {
      into.push(turnPostBodySchema.parse(route.request().postDataJSON()))
    }
    return route.fallback()
  })
}

function settleExecutionFrames(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0))
        )
      })
  )
}

const outputFilename = (jobId: string) => `${jobId}.png`

async function createAgentLocalRunRig(
  page: Page,
  socketSid: string,
  openPeer: () => Promise<AgentLocalRunRig>
): Promise<AgentLocalRunRig> {
  if (!socketSid) {
    await page.addInitScript(
      (staleId) => sessionStorage.setItem('clientId', staleId),
      STALE_SESSION_CLIENT_ID
    )
  }

  const harness = new AgentMultiAutogrowRealignHarness(page, { socketSid })
  await harness.setUp({ settings: { 'Comfy.Queue.QPOV2': false } })

  const turnPosts: TurnPostBody[] = []
  await recordTurnPosts(page, turnPosts)

  const execution = new AgentExecutionHelper(page, harness.hostSocket)
  await execution.install()
  const lastTurnClientId = () => turnPosts.at(-1)?.client_id
  execution.addressFramesWhen(() => lastTurnClientId() === COMFY_SOCKET_SID)

  if (socketSid) {
    await page.waitForFunction(
      (expectedSid) => sessionStorage.getItem('clientId') === expectedSid,
      socketSid
    )
  }

  await harness.bindAndAwaitFirstTurn()
  await page.evaluate((attribute) => {
    window.app!.api.addEventListener('status', (event) => {
      const count = (
        event as CustomEvent<{
          exec_info?: { queue_remaining?: number }
        }>
      ).detail.exec_info?.queue_remaining
      if (count !== undefined) {
        document.documentElement.setAttribute(attribute, String(count))
      }
    })
  }, QUEUE_REMAINING_ATTRIBUTE)

  const startRunForUser = async (jobId: string) => {
    await execution.enqueueServerRun(jobId)
    await execution.stallJob(jobId, { nodeId: TARGET_ID })
  }
  const finishRunForUser = (jobId: string) =>
    execution.completeJob(jobId, {
      nodeId: String(SOURCE_NODE_ID),
      filename: outputFilename(jobId)
    })

  return {
    page,
    harness,
    turnPosts: () => turnPosts,
    lastTurnClientId,
    startRunForUser,
    settleExecutionFrames: () => settleExecutionFrames(page),
    waitForQueueRemaining: async (count: number) => {
      await page.waitForFunction(
        ({ attribute, count }) =>
          document.documentElement.getAttribute(attribute) === String(count),
        { attribute: QUEUE_REMAINING_ATTRIBUTE, count }
      )
    },
    finishRunForUser,
    runWorkflowForUser: async (jobId: string) => {
      await startRunForUser(jobId)
      await finishRunForUser(jobId)
    },
    runningOutline: harness.targetNode.locator(':scope.outline-primary'),
    outputImage: harness.outputImage(SOURCE_NODE_ID),
    outputFilename,
    openPeer
  }
}

/** The agent harness, its execution surface, and the turn POST bodies sent. */
export const agentLocalRunTest = agentTest.extend<
  AgentLocalRunOptions & { rig: AgentLocalRunRig }
>({
  socketReportsId: [true, { option: true }],
  rig: async ({ browser, page, socketReportsId }, use) => {
    const peerContexts: BrowserContext[] = []
    const openPeer = async () => {
      const peerContext = await browser.newContext()
      peerContexts.push(peerContext)
      const peerPage = await peerContext.newPage()
      return createAgentLocalRunRig(peerPage, PEER_SOCKET_SID, openPeer)
    }
    const rig = await createAgentLocalRunRig(
      page,
      socketReportsId ? COMFY_SOCKET_SID : '',
      openPeer
    )
    try {
      await use(rig)
    } finally {
      await Promise.all(peerContexts.map((peerContext) => peerContext.close()))
    }
  }
})
