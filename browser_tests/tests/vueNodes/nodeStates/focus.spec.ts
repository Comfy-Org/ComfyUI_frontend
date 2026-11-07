import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

test.describe('Vue node focus', { tag: ['@vue-nodes', '@node'] }, () => {
  test('holding Shift does not outline slot hit areas on a selected node', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await fitToViewInstant(comfyPage)

    const node = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const selection = node.getByTestId('node-state-outline-overlay')

    await comfyPage.vueNodes.selectNode('3')
    await expect(node).toBeFocused()
    await expect(selection).toBeVisible()
    await expect(node).toHaveCSS('outline-style', 'none')

    await comfyPage.page.keyboard.down('Shift')

    await expect(node).toBeFocused()
    await expect(node).toHaveCSS('outline-style', 'none')
    await expect(selection).toBeVisible()

    await comfyPage.page.keyboard.up('Shift')
    await expect(node).toHaveCSS('outline-style', 'none')
  })

  for (const forcedColors of ['none', 'active'] as const) {
    test(`keyboard focus distinguishes a selected node with forced colors ${forcedColors}`, async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await fitToViewInstant(comfyPage)
      await comfyPage.page.emulateMedia({ forcedColors })

      const node = comfyPage.vueNodes.getNodeByTitle('KSampler')
      const otherNode = comfyPage.vueNodes.getNodeByTitle('Empty Latent Image')

      await comfyPage.vueNodes.selectNode('3')
      await comfyPage.page.keyboard.press('Control+a')
      await node.press('Tab')
      await comfyPage.page.keyboard.press('Shift+Tab')

      await expect(node).toBeFocused()
      await expect(node).toHaveAttribute('data-emphasized', 'true')
      await expect(otherNode).toHaveAttribute('data-emphasized', 'true')
      await expect(node).toHaveCSS('outline-style', 'none')
      await expect(node.getByTestId('node-state-outline-overlay')).toHaveCSS(
        'outline-style',
        'auto'
      )
      await expect(
        otherNode.getByTestId('node-state-outline-overlay')
      ).toHaveCSS('outline-style', 'none')
    })
  }
})
