import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({ deviceScaleFactor: 1.5 })

test.describe(
  'Link interaction at emulated display scaling',
  { tag: '@canvas' },
  () => {
    for (const renderer of [
      { name: 'legacy', vueNodes: false },
      { name: 'Vue', vueNodes: true }
    ] as const) {
      test(`disconnects and reconnects the exact endpoint at 150 percent in the ${renderer.name} renderer`, async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          renderer.vueNodes
        )
        await comfyPage.workflow.loadWorkflow('default')
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.Action',
          'no action'
        )
        expect(
          await comfyPage.page.evaluate(() => window.devicePixelRatio)
        ).toBe(1.5)

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
          // Node ids serialise as strings, so normalise before comparing
          // rather than asserting on the current runtime type.
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
      })
    }
  }
)
