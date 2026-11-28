import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  AgentEmptyCanvasFramingHarness,
  TEMPLATE_NODE_IDS,
  TEMPLATE_NODE_POSITIONS,
  nodePositions,
  nodeVisibility
} from '@e2e/fixtures/helpers/AgentEmptyCanvasFramingHarness'

test.describe(
  'Agent batch on an empty canvas',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test(
      'brings the inserted nodes into view without moving them',
      {
        annotation: {
          type: 'issue',
          description: 'https://linear.app/comfyorg/issue/PM-2072'
        }
      },
      async ({ page }, testInfo) => {
        test.setTimeout(60_000)
        const harness = new AgentEmptyCanvasFramingHarness(page)
        await harness.boot()
        await harness.sendPrompt('Build me an image edit workflow')
        await harness.insertTemplate()
        await harness.waitForTurnComplete()

        await expect
          .poll(async () => nodePositions(page, TEMPLATE_NODE_IDS), {
            message:
              'this decision moves the camera, never the batch: every template ' +
              'node must reach the canvas at the coordinates the template baked in',
            timeout: 10_000
          })
          .toEqual(
            Object.fromEntries(
              TEMPLATE_NODE_IDS.map((id) => [
                String(id),
                TEMPLATE_NODE_POSITIONS[id]
              ])
            )
          )

        await expect
          .poll(async () => nodeVisibility(page, TEMPLATE_NODE_IDS), {
            message:
              'the agent built the workflow onto an empty canvas and left the ' +
              'camera at the origin, so the user is looking at a canvas that ' +
              'is not empty and appears to be',
            timeout: 10_000
          })
          .toEqual(
            Object.fromEntries(
              TEMPLATE_NODE_IDS.map((id) => [String(id), true])
            )
          )

        await testInfo.attach('framed-batch.png', {
          body: await page.screenshot(),
          contentType: 'image/png'
        })
      }
    )
  }
)
