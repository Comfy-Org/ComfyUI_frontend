import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

test.describe('Vue Nodes Renaming', { tag: '@vue-nodes' }, () => {
  test('should display node title', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.header).toContainText('KSampler')
  })

  test('should allow title renaming by double clicking on the node header', async ({
    comfyPage
  }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    // Test renaming with Enter
    await vueNode.setTitle('My Custom Sampler')
    await expect(vueNode.title).toHaveText('My Custom Sampler')
    await expect(vueNode.header).toContainText('My Custom Sampler')

    // Test cancel with Escape
    await vueNode.title.dblclick()
    await comfyPage.nextFrame()
    await vueNode.titleEditor.input.fill('This Should Be Cancelled')
    await vueNode.titleEditor.cancel()
    await comfyPage.nextFrame()

    // Title should remain as the previously saved value
    await expect(vueNode.title).toHaveText('My Custom Sampler')
  })

  test('Double click node body calls the node onDblClick without editing the title, and a widget double click does not', async ({
    comfyPage
  }) => {
    const [ref] = await comfyPage.nodeOps.getNodeRefsByType(
      'CheckpointLoaderSimple'
    )
    await comfyPage.page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(id)!
      let opened = 0
      node.onDblClick = () => {
        node.title = `Opened ${++opened}`
      }
    }, ref.id)
    const vueNode = new VueNodeFixture(
      comfyPage.vueNodes.getNodeLocator(String(ref.id))
    )
    const header = await vueNode.header.boundingBox()
    if (!header) throw new Error('Node header not found')

    await test.step('Double click the node body', async () => {
      await vueNode.root.dblclick({
        position: { x: header.width / 3, y: header.height + 8 }
      })
      await comfyPage.titleEditor.expectHidden()
      await expect(vueNode.title).toHaveText('Opened 1')
    })

    await test.step('Double click a widget', async () => {
      await vueNode.widgets.first().dblclick()
      await comfyPage.nextFrame()
      await expect(vueNode.title).toHaveText('Opened 1')
    })
  })
})
