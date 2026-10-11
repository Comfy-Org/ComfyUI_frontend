import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

for (const width of [960, 1100]) {
  test.describe(`Topbar badges at ${width}px`, { tag: '@ui' }, () => {
    test.use({ viewport: { width, height: 720 } })

    test('names the trigger and reveals its full text', async ({
      comfyPage
    }) => {
      await test.step('Register and verify the compact badge', async () => {
        await comfyPage.page.evaluate(() => {
          window.app!.registerExtension({
            name: 'Test.TopbarBadge',
            topbarBadges: [{ text: 'Extension status', icon: 'pi pi-cloud' }]
          })
        })
        const trigger = comfyPage.page.getByRole('button', {
          name: 'Extension status',
          exact: true
        })
        await expect(trigger).toBeVisible()
        await expect(trigger).toHaveCSS('border-top-width', '0px')
        await expect(
          comfyPage.page.getByText('Extension status', { exact: true })
        ).toBeHidden()
      })

      await test.step('Open and dismiss the full badge text', async () => {
        const trigger = comfyPage.page.getByRole('button', {
          name: 'Extension status',
          exact: true
        })
        await trigger.click()
        await expect(comfyPage.page.getByRole('dialog')).toContainText(
          'Extension status'
        )
        await comfyPage.page.keyboard.press('Escape')
        await expect(comfyPage.page.getByRole('dialog')).toBeHidden()
        await expect(trigger).toBeFocused()
      })
    })
  })
}
