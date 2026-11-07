import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

test.describe('Vue node focus', { tag: ['@vue-nodes', '@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await fitToViewInstant(comfyPage)
  })

  test('holding Shift does not outline slot hit areas on a selected node', async ({
    comfyPage
  }) => {
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
})
