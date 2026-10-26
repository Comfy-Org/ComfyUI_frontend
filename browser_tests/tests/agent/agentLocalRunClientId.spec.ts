import { expect } from '@playwright/test'

import {
  STALE_SESSION_CLIENT_ID,
  agentLocalRunTest as test
} from '@e2e/fixtures/agentLocalRunClientIdFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { COMFY_SOCKET_SID } from '@e2e/fixtures/agentFollowerHostSocket'

test.describe(
  'Agent local run follows this canvas by borrowing its client id (PM-1875)',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a run the agent starts highlights and lands its output only on this connected canvas', async ({
      rig: {
        turnPosts,
        startRunForUser,
        finishRunForUser,
        runningOutline,
        outputImage,
        outputFilename,
        openPeer
      },
      page
    }) => {
      test.setTimeout(60_000)
      expect(turnPosts()).toHaveLength(1)
      expect(turnPosts()[0]).toMatchObject({ client_id: COMFY_SOCKET_SID })

      const peer = await openPeer()
      const jobId = 'agent-local-run-addressed'
      await Promise.all([startRunForUser(jobId), peer.startRunForUser(jobId)])
      await peer.waitForQueueRemaining(1)

      await expect(runningOutline).toBeVisible()
      await expect(peer.runningOutline).toHaveCount(0)

      const queuePanel = new QueuePanel(page)
      await expect(
        queuePanel.overlay.getByText(/^Current node:.*25%$/)
      ).toBeVisible()

      await Promise.all([finishRunForUser(jobId), peer.finishRunForUser(jobId)])
      await peer.waitForQueueRemaining(0)

      await expect(outputImage).toBeVisible()
      await expect(outputImage).toHaveAttribute(
        'src',
        new RegExp(outputFilename(jobId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      )

      await queuePanel.open()
      await expect(queuePanel.jobRow(jobId)).toBeVisible()

      const peerQueuePanel = new QueuePanel(peer.page)
      await peerQueuePanel.open()
      await expect(peerQueuePanel.jobRow(jobId)).toBeVisible()
      await expect(peer.outputImage).toHaveCount(0)
    })

    test.describe('before this tab has a socket id of its own', () => {
      test.use({ socketReportsId: false })

      test('the turn omits client_id rather than borrowing a stale one', async ({
        rig: { turnPosts }
      }) => {
        expect(turnPosts()).toHaveLength(1)
        const [body] = turnPosts()

        expect(Object.keys(body)).not.toContain('client_id')
        expect(JSON.stringify(body)).not.toContain(STALE_SESSION_CLIENT_ID)
      })

      test('the run still completes, and only this canvas cannot follow it', async ({
        rig: {
          harness,
          startRunForUser,
          settleExecutionFrames,
          finishRunForUser,
          runningOutline,
          outputImage
        },
        page
      }) => {
        const jobId = 'agent-local-run-unaddressed'
        await expect(harness.sourceNode).toBeVisible()
        await startRunForUser(jobId)
        await settleExecutionFrames()

        await expect(runningOutline).toHaveCount(0)

        await finishRunForUser(jobId)
        await settleExecutionFrames()

        const queuePanel = new QueuePanel(page)
        await queuePanel.open()
        await expect(queuePanel.jobRow(jobId)).toBeVisible()

        await expect(outputImage).toHaveCount(0)
      })
    })
  }
)
