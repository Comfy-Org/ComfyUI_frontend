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

    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

    await node.select()
    await expect(node.root).toBeFocused()
    await expect(node.stateOutline).toBeVisible()
    await node.expectNoRootOutline()

    await comfyPage.page.keyboard.down('Shift')

    await expect(node.root).toBeFocused()
    await node.expectNoRootOutline()
    await expect(node.stateOutline).toBeVisible()

    await comfyPage.page.keyboard.up('Shift')
    await node.expectNoRootOutline()
  })

  for (const forcedColors of ['none', 'active'] as const) {
    test(`keyboard focus is bounded for selected and unselected nodes with forced colors ${forcedColors}`, async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await fitToViewInstant(comfyPage)
      await comfyPage.page.emulateMedia({ forcedColors })

      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const otherNode =
        await comfyPage.vueNodes.getFixtureByTitle('Empty Latent Image')

      await node.root.press('Tab')
      await comfyPage.page.keyboard.press('Shift+Tab')

      await expect(node.root).toBeFocused()
      await expect(node.root).not.toHaveAttribute('data-emphasized')
      await node.expectNoRootOutline()
      await node.expectFocusOutline(true)
      await expect(node.stateOutline).toHaveCSS('border-top-width', '0px')

      await node.root.press('Tab')
      await expect(node.stateOutline).toBeHidden()

      await node.select()
      await comfyPage.page.keyboard.press('Control+a')
      await node.root.press('Tab')
      await comfyPage.page.keyboard.press('Shift+Tab')

      await expect(node.root).toBeFocused()
      await expect(node.root).toHaveAttribute('data-emphasized', 'true')
      await expect(otherNode.root).toHaveAttribute('data-emphasized', 'true')
      await node.expectNoRootOutline()
      await node.expectFocusOutline(true)
      await otherNode.expectFocusOutline(false)
    })
  }
})
