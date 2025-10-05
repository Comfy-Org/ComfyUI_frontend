import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'

const ERROR_CLASS = /border-error/

test.describe('Vue Node Error', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should display error state when node is missing (node from workflow is not installed)', async ({
    comfyPage
  }) => {
    await comfyPage.setup()
    await comfyPage.loadWorkflow('missing/missing_nodes')

    // Close missing nodes warning dialog
    await comfyPage.page.getByRole('button', { name: 'Close' }).click()
    await comfyPage.page.waitForSelector('.comfy-missing-nodes', {
      state: 'hidden'
    })

    // Expect error state on missing unknown node
    const unknownNode = comfyPage.page.locator('[data-node-id]').filter({
      hasText: 'UNKNOWN NODE'
    })
    await expect(unknownNode).toHaveClass(ERROR_CLASS)
  })
})
