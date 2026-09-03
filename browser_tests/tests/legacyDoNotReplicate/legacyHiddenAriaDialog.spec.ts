import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'

test(
  'Ctrl/Cmd+S works with a mounted hidden ARIA dialog from a legacy custom node',
  { tag: ['@custom-nodes', '@keyboard'] },
  async ({ comfyPage }) => {
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)
    await legacyApi.addNodeWithMountedHiddenAriaDialog()

    const hiddenDialog = comfyPage.page.locator(
      '[data-devtools-hidden-aria-dialog]'
    )
    await expect(hiddenDialog).toHaveAttribute('role', 'dialog')
    await expect(hiddenDialog).toHaveAttribute('aria-modal', 'true')
    await expect(hiddenDialog).toHaveAttribute('hidden', '')

    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+s')

    await expect(comfyPage.menu.topbar.getSaveDialog()).toBeVisible()
  }
)
