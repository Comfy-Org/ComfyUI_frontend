import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test('Can display a slot mismatched from widget type', async ({
  comfyPage
}) => {
  await comfyPage.page.evaluate(() => {
    const emptyLatent = window.app!.graph.getNodeById(5)!
    emptyLatent.inputs[0].type = 'INT,FLOAT'
  })
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

  const width = comfyPage.vueNodes
    .getNodeByTitle('Empty Latent')
    .locator('.lg-node-widget')
    .first()
  await expect(width.locator('path[fill*="INT"]')).toBeVisible()
  await expect(width.locator('path[fill*="FLOAT"]')).toBeVisible()
})
