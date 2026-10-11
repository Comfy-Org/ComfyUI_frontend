import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({
  deviceScaleFactor: 1.5,
  initialSettings: { 'Comfy.LinkRelease.Action': 'no action' }
})

test.describe('Link interaction at emulated display scaling', () => {
  test(
    'disconnects and reconnects the exact endpoint at 150 percent in the legacy renderer',
    { tag: '@canvas' },
    async ({ comfyPage }) => {
      test.slow()
      await expectExactEndpointRoundTrip(comfyPage)
    }
  )

  test(
    'disconnects and reconnects the exact endpoint at 150 percent in the Vue renderer',
    { tag: ['@canvas', '@vue-nodes'] },
    async ({ comfyPage }) => {
      test.slow()
      await expectExactEndpointRoundTrip(comfyPage)
    }
  )
})

async function expectExactEndpointRoundTrip(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('default')
  expect(await comfyPage.page.evaluate(() => window.devicePixelRatio)).toBe(1.5)

  const checkpoint = await comfyPage.nodeOps.getNodeRefById(4)
  const prompt = await comfyPage.nodeOps.getNodeRefById(6)
  const output = await checkpoint.getOutput(1)
  const input = await prompt.getInput(0)

  await test.step('disconnect the prompt input', async () => {
    await comfyPage.canvasOps.dragAndDrop(await input.getPosition(), {
      x: 800,
      y: 100
    })
    await input.expectLinkCount(0)
  })

  await test.step('reconnect the exact endpoint', async () => {
    await comfyPage.canvasOps.dragAndDrop(
      await output.getPosition(),
      await input.getPosition()
    )
    // Node ids serialise as strings, so normalise before comparing rather
    // than asserting on the current runtime type.
    await expect
      .poll(async () => {
        const link = await input.getLink()
        if (!link) return null
        return {
          origin_id: String(link.origin_id),
          origin_slot: link.origin_slot,
          target_id: String(link.target_id),
          target_slot: link.target_slot
        }
      })
      .toEqual({
        origin_id: '4',
        origin_slot: 1,
        target_id: '6',
        target_slot: 0
      })
    await output.expectLinkCount(2)
  })
}
