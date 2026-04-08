import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { assertNodeSlotsWithinBounds } from '@e2e/fixtures/utils/slotBoundsUtil'

const NODE_ID = '3'
const NODE_TITLE = 'KSampler'

test.describe(
  'Collapsed node link positions',
  { tag: ['@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.vueNodes.waitForNodes()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('link endpoints stay within collapsed node bounds', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
    })

    test('links follow collapsed node after drag', async ({ comfyPage }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      const box = await node.boundingBox()
      expect(box).not.toBeNull()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2,
        box!.y + box!.height / 2
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2 + 200,
        box!.y + box!.height / 2 + 100,
        { steps: 10 }
      )
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
    })

    test('links recover correct positions after expand', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
    })
  }
)
