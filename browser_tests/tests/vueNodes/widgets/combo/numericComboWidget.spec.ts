import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Numeric combo widget',
  { tag: ['@widget', '@vue-nodes'] },
  () => {
    test('Valid numeric defaults are not marked invalid', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.nextFrame()

      await comfyPage.searchBoxV2.addNode('Node With Numeric Combo')
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'Node With Numeric Combo'
      )
      const duration = node.root.getByRole('combobox', {
        name: 'duration',
        exact: true
      })

      await expect(duration).toHaveText('5')
      await expect(duration).not.toHaveAttribute('aria-invalid')
    })

    test('Price badge updates after selecting a numeric option', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.nextFrame()

      await comfyPage.searchBoxV2.addNode('Node With Numeric Combo')
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'Node With Numeric Combo'
      )
      const priceBadge = node.priceBadge.required
      await expect(priceBadge).toBeVisible()
      await expect(priceBadge).toHaveText('211')

      await comfyPage.vueNodes.selectComboOption(
        'Node With Numeric Combo',
        'duration',
        '10'
      )

      await expect(priceBadge).toBeVisible()
      await expect(priceBadge).toHaveText('422')
    })
  }
)
