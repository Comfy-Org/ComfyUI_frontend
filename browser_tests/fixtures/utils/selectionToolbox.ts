import type { Locator } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

/**
 * Opens the selection toolbox "More Options" menu and returns the menu
 * locator so callers can scope follow-up queries to it.
 */
export async function openMoreOptions(comfyPage: ComfyPage): Promise<Locator> {
  await expect(comfyPage.selectionToolbox).toBeVisible()

  const moreOptionsBtn = comfyPage.page.getByTestId('more-options-button')
  await expect(moreOptionsBtn).toBeVisible()
  await moreOptionsBtn.click()

  const menu = comfyPage.page.locator('.p-contextmenu')
  await expect(menu.getByText('Copy', { exact: true })).toBeVisible()
  return menu
}
