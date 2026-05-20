import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue Color Widget defaults (FE-800)',
  { tag: '@vue-nodes' },
  () => {
    test('respects a non-black default declared on the node input', async ({
      comfyPage
    }) => {
      const nodeRef = await comfyPage.nodeOps.addNode(
        'DevToolsNodeWithColorInput'
      )
      await comfyPage.vueNodes.waitForNodes()

      const widget = await nodeRef.getWidgetByName('color_input')
      await expect.poll(() => widget.getValue()).toBe('#00ff00')
    })
  }
)
