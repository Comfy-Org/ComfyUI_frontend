import { expect } from '@playwright/test'

import {
  STALE_SESSION_CLIENT_ID,
  STALLED_NODE_PROGRESS,
  agentLocalRunTest as test
} from '@e2e/fixtures/agentLocalRunClientIdFixture'
import { QueuePanel } from '@e2e/fixtures/components/QueuePanel'
import { COMFY_SOCKET_SID } from '@e2e/fixtures/agentFollowerHostSocket'

/**
 * What the overlay prints for the step the stalled run is frozen at. Derived
 * from the frame the fixture sends, so tuning that frame moves the expectation
 * with it instead of failing with a figure that points nowhere. The run below
 * guards that the step is a strict partial one, because deriving the figure is
 * what keeps the two in step and is also what would let a step of 0 turn the
 * assertion into "render whatever was sent".
 */
const stalledNodePercent = `${Math.round(
  (STALLED_NODE_PROGRESS.value / STALLED_NODE_PROGRESS.max) * 100
)}%`

/**
 * Source: https://comfy-organization.slack.com/archives/C0BGH348Z0C/p1790791524330409
 * Ticket: https://linear.app/comfyorg/issue/PM-1875
 */
test.describe(
  'Agent local run follows this canvas by borrowing its client id (PM-1875)',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a run the agent starts highlights and lands its output on this canvas', async ({
      rig: {
        turnPosts,
        startRunForUser,
        finishRunForUser,
        runningOutline,
        outputImage,
        outputFilename
      },
      page
    }) => {
      expect(turnPosts()).toHaveLength(1)
      expect(turnPosts()[0]).toMatchObject({ client_id: COMFY_SOCKET_SID })

      const jobId = 'agent-local-run-addressed'
      await startRunForUser(jobId)

      await expect(runningOutline).toBeVisible()

      // The outline only says *which* node is running. The report was also
      // about a number — progress "stuck at 0%" — so pin the figure the queue
      // overlay prints for that node. It is a second view over the same
      // `executionStore` progress state the outline reads, not a second
      // delivery path, so what this adds is the value and not extra coverage of
      // the routing. Scoped to the current-node element because the overlay
      // also prints a whole-run total, and visible rather than merely attached
      // because the overlay's wrapper is `v-show`n.
      //
      // The stall has to be a strict partial step for that to mean anything: at
      // 0 the expectation derives to the very symptom reported, and at `max` to
      // a finished node. Asserted rather than assumed, because the figure below
      // is computed from these two numbers.
      expect(STALLED_NODE_PROGRESS.value).toBeGreaterThan(0)
      expect(STALLED_NODE_PROGRESS.value).toBeLessThan(
        STALLED_NODE_PROGRESS.max
      )

      const queuePanel = new QueuePanel(page)
      await expect(queuePanel.progressCurrentNodePercent).toBeVisible()
      await expect(queuePanel.progressCurrentNodePercent).toHaveText(
        stalledNodePercent
      )

      await finishRunForUser(jobId)

      await expect(outputImage).toBeVisible()
      await expect(outputImage).toHaveAttribute(
        'src',
        new RegExp(outputFilename(jobId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      )

      await queuePanel.open()
      await expect(queuePanel.jobRow(jobId)).toBeVisible()
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
