import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

test.describe('Vue Node Selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  const modifiers = [
    { key: 'Control', name: 'ctrl' },
    { key: 'Shift', name: 'shift' }
  ] as const

  for (const { key: modifier, name } of modifiers) {
    test(`should allow selecting multiple nodes with ${name}+click`, async ({
      comfyPage
    }) => {
      await comfyPage.page.getByText('Load Checkpoint').click()
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

      await comfyPage.page.getByText('Empty Latent Image').click({
        modifiers: [modifier]
      })
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(2)

      await comfyPage.page.getByText('KSampler').click({
        modifiers: [modifier]
      })
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(3)
    })

    test(`should allow de-selecting nodes with ${name}+click`, async ({
      comfyPage
    }) => {
      await comfyPage.page.getByText('Load Checkpoint').click()
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(1)

      await comfyPage.page.getByText('Load Checkpoint').click({
        modifiers: [modifier]
      })
      expect(await comfyPage.vueNodes.getSelectedNodeCount()).toBe(0)
    })
  }
})
