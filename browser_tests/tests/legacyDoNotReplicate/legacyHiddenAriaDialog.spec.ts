import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'

test(
  'Ctrl/Cmd+S works with mounted hidden ARIA dialogs from a legacy custom node',
  { tag: '@keyboard' },
  async ({ comfyPage }) => {
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)
    await legacyApi.addNodeWithMountedHiddenAriaDialog()

    const hiddenDialog = comfyPage.page.locator('[data-devtools-hidden-dialog]')
    await expect(hiddenDialog).toHaveAttribute('role', 'dialog')
    await expect(hiddenDialog).toHaveAttribute('aria-modal', 'true')
    await expect(hiddenDialog).toHaveAttribute('hidden', '')

    const directHiddenDialog = comfyPage.page.locator(
      '[data-devtools-direct-hidden-dialog]'
    )
    await expect(directHiddenDialog).toHaveAttribute('role', 'dialog')
    await expect(directHiddenDialog).toHaveAttribute('aria-modal', 'true')
    await expect(directHiddenDialog).toHaveAttribute('aria-hidden', 'true')
    await expect(directHiddenDialog).toBeHidden()

    const ancestorHiddenDialog = comfyPage.page.locator(
      '[hidden] [data-devtools-hidden-ancestor-dialog]'
    )
    await expect(ancestorHiddenDialog).toHaveAttribute('role', 'dialog')
    await expect(ancestorHiddenDialog).toHaveAttribute('aria-modal', 'true')
    await expect(ancestorHiddenDialog).toBeHidden()

    const cssHiddenDialog = comfyPage.page.locator(
      '[aria-hidden="true"] [data-devtools-class-hidden-ancestor-dialog]'
    )
    await expect(cssHiddenDialog).toHaveAttribute('role', 'dialog')
    await expect(cssHiddenDialog).toHaveAttribute('aria-modal', 'true')
    await expect(cssHiddenDialog).toBeHidden()

    const inlineHiddenDialog = comfyPage.page.locator(
      '[data-devtools-inline-hidden-ancestor-dialog]'
    )
    await expect(inlineHiddenDialog).toHaveAttribute('role', 'dialog')
    await expect(inlineHiddenDialog).toHaveAttribute('aria-modal', 'true')
    await expect(inlineHiddenDialog).toBeHidden()

    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+s')

    await expect(comfyPage.menu.topbar.getSaveDialog()).toBeVisible()
  }
)
