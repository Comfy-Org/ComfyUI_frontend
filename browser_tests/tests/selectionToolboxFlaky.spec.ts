import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'
import type { ComfyPage } from '../fixtures/ComfyPage'

async function selectNodeWithPan(comfyPage: ComfyPage, nodeRef: NodeReference) {
  const nodePos = await nodeRef.getPosition()
  await comfyPage.page.evaluate((pos) => {
    const canvas = window.app!.canvas
    canvas.ds.offset[0] = -pos.x + canvas.canvas.width / 2
    canvas.ds.offset[1] = -pos.y + canvas.canvas.height / 2 + 100
    canvas.setDirty(true, true)
  }, nodePos)
  await comfyPage.nextFrame()
  await nodeRef.click('title')
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})

test.describe(
  'Selection Toolbox - Flaky CI Tests (manual investigation needed)',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Canvas.SelectionToolbox',
        true
      )
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await comfyPage.nextFrame()
    })

    // These tests pass locally but fail in CI headless due to SelectionToolbox
    // CSS transform positioning (useSelectionToolboxPosition composable).
    // The toolbox uses requestAnimationFrame-based position sync that places
    // buttons outside the visible area in headless viewport.
    test.skip(
      'bypass button toggles node bypass state',
      async ({ comfyPage }) => {
        const nodeRef = (
          await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
        )[0]
        await selectNodeWithPan(comfyPage, nodeRef)

        const bypassButton = comfyPage.page.locator(
          '[data-testid="bypass-button"]'
        )
        await expect(bypassButton).toBeVisible()
        await bypassButton.click({ force: true })
        await comfyPage.nextFrame()

        await expect(nodeRef).toBeBypassed()

        await selectNodeWithPan(comfyPage, nodeRef)

        await expect(bypassButton).toBeVisible()
        await bypassButton.click({ force: true })
        await comfyPage.nextFrame()

        await expect(nodeRef).not.toBeBypassed()
      }
    )

    test.skip(
      'refresh button is visible when node is selected',
      async ({ comfyPage }) => {
        const nodeRef = (
          await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
        )[0]
        await selectNodeWithPan(comfyPage, nodeRef)

        await expect(
          comfyPage.page.locator('[data-testid="refresh-button"]')
        ).toBeVisible()
      }
    )
  }
)
