import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('App mode mobile assets', { tag: ['@mobile'] }, () => {
  test('assets pane has no sidebar close button', async ({ comfyPage }) => {
    const { mobile } = comfyPage.appMode
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'steps']])
    await mobile.navigateTab('assets')
    await expect(mobile.contentPanel).toHaveAccessibleName('Assets')
    await expect(
      mobile.contentPanel.getByRole('tab', { name: 'Generated' })
    ).toBeVisible()

    await expect(
      mobile.contentPanel.getByTestId(TestIds.sidebar.closeButton)
    ).toHaveCount(0)
  })
})
