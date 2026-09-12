import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test('opens the settings menu for the video recording demo', async ({
  comfyPage
}) => {
  await comfyPage.settingDialog.open()
  await expect(comfyPage.settingDialog.root).toBeVisible()
})
