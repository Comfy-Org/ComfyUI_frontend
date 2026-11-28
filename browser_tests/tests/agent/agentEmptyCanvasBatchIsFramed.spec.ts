import { expect } from '@playwright/test'

import {
  TEMPLATE_NODE_IDS,
  TEMPLATE_NODE_POSITIONS,
  agentEmptyCanvasFramingTest as test,
  nodePositions,
  renderedNodeVisibility,
  nodeVisibility
} from '@e2e/fixtures/helpers/AgentEmptyCanvasFramingHarness'
import { waitForCanvasViewToSettle } from '@e2e/fixtures/helpers/CanvasHelper'

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
      async ({ page, agentEmptyCanvasFraming }, testInfo) => {
        await agentEmptyCanvasFraming.sendPrompt(
          'Build me an image edit workflow'
        )
        await agentEmptyCanvasFraming.insertTemplate()
        await agentEmptyCanvasFraming.waitForTurnComplete()

        const expectedPositions = Object.fromEntries(
          TEMPLATE_NODE_IDS.map((id) => [
            String(id),
            TEMPLATE_NODE_POSITIONS[id]
          ])
        )
        const expectedVisibility = Object.fromEntries(
          TEMPLATE_NODE_IDS.map((id) => [String(id), true])
        )

        await expect
          .poll(async () => nodePositions(page, TEMPLATE_NODE_IDS), {
            message:
              'this decision moves the camera, never the batch: every template ' +
              'node must reach the canvas at the coordinates the template baked in',
            timeout: 10_000
          })
          .toEqual(expectedPositions)

        await expect
          .poll(async () => nodeVisibility(page, TEMPLATE_NODE_IDS), {
            message:
              'the agent built the workflow onto an empty canvas and left the ' +
              'camera at the origin, so the user is looking at a canvas that ' +
              'is not empty and appears to be',
            timeout: 10_000
          })
          .toEqual(expectedVisibility)

        await waitForCanvasViewToSettle(page)
        await expect
          .poll(() => renderedNodeVisibility(page, TEMPLATE_NODE_IDS))
          .toEqual(expectedVisibility)
        await expect
          .poll(() => nodePositions(page, TEMPLATE_NODE_IDS))
          .toEqual(expectedPositions)

        await testInfo.attach('framed-batch.png', {
          body: await page.screenshot(),
          contentType: 'image/png'
        })
      }
    )
  }
)
