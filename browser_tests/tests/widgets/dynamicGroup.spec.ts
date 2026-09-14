import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'DynamicGroup canvas controls',
  { tag: ['@widget', '@oss'] },
  () => {
    test.use({ initialSettings: { 'Comfy.VueNodes.Enabled': false } })

    test('adds and removes rows with the canvas buttons', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('inputs/dynamic_group')
      const node = await comfyPage.nodeOps.getNodeRefById('1')
      const count = await node.getWidgetByName('loras')

      await (await node.getWidgetByName('loras.$add')).click()
      await expect.poll(() => count.getValue()).toBe(1)
      await (await node.getWidgetByName('loras.$add')).click()
      await expect.poll(() => count.getValue()).toBe(2)
      await (await node.getWidgetByName('loras.0')).click()
      await expect.poll(() => count.getValue()).toBe(1)
      await (await node.getWidgetByName('loras.0')).click()
      await expect.poll(() => count.getValue()).toBe(0)
    })
  }
)
