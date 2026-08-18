import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test('Can display a slot mismatched from widget type', async ({
  comfyPage
}) => {
  await comfyPage.page.evaluate((nodeId) => {
    const emptyLatent = window.app!.graph.getNodeById(nodeId)!
    emptyLatent.inputs[0].type = 'INT,FLOAT'
  }, toNodeId(5))
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

  const width = comfyPage.vueNodes
    .getNodeByTitle('Empty Latent')
    .locator('.lg-node-widget')
    .first()
  await expect(width.locator('path[fill*="INT"]')).toBeVisible()
  await expect(width.locator('path[fill*="FLOAT"]')).toBeVisible()
})

test('MatchType updates output color @vue-nodes', async ({ comfyPage }) => {
  await comfyPage.menu.topbar.newWorkflowButton.click()
  await comfyPage.nextFrame()

  await comfyPage.searchBoxV2.addNode('Load Image')
  const loadImage = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
  await comfyPage.searchBoxV2.addNode('Switch', {
    position: { x: 600, y: 200 }
  })
  const switchNode = await comfyPage.vueNodes.getFixtureByTitle('switch')

  await loadImage.getSlot('MASK').dragTo(switchNode.getSlot('on_false'))
  const slotEl = switchNode.getSlot('output').locator('.slot-dot')
  await expect.poll(() => slotEl.getAttribute('style')).toContain('MASK')
})
