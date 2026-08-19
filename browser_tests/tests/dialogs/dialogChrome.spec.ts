import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Contract shared by every dialog rendered through `GlobalDialog`, exercised
 * against the core prompt/confirm dialogs and Settings. The behaviours here —
 * real focus movement, real stacking order, real pointer inertness — are the
 * ones jsdom cannot observe, so they are only meaningful in a browser.
 */
test.describe('Dialog chrome', { tag: '@ui' }, () => {
  test('moves focus onto the content autofocus target when opened', async ({
    comfyPage
  }) => {
    const chrome = comfyPage.dialogChrome

    await chrome.openPrompt()

    const dialog = chrome.dialogs
    await expect(dialog).toBeVisible()
    await expect(
      dialog.locator('input[autofocus]'),
      'GlobalDialog focuses the [autofocus] target instead of the first tabbable element'
    ).toBeFocused()
  })

  test('keeps Tab focus inside a modal dialog', async ({ comfyPage }) => {
    const chrome = comfyPage.dialogChrome
    await chrome.openPrompt()
    const dialog = chrome.dialogs
    await expect(dialog).toBeVisible()

    for (let press = 1; press <= 6; press++) {
      await comfyPage.page.keyboard.press('Tab')
      expect(
        await chrome.isFocusInside(dialog),
        `focus escaped the modal dialog after ${press} Tab press(es)`
      ).toBe(true)
    }
  })

  test('makes the page pointer-inert while a modal dialog is open', async ({
    comfyPage
  }) => {
    const chrome = comfyPage.dialogChrome
    expect(await chrome.isPageInert()).toBe(false)

    await chrome.openPrompt()
    await expect(chrome.dialogs).toBeVisible()
    await expect.poll(() => chrome.isPageInert()).toBe(true)

    await comfyPage.page.keyboard.press('Escape')
    await expect(chrome.dialogs).toBeHidden()
    await expect
      .poll(() => chrome.isPageInert(), {
        message: 'page stayed inert after the modal dialog closed'
      })
      .toBe(false)
  })

  test('restores focus to the invoking element when closed', async ({
    comfyPage
  }) => {
    const chrome = comfyPage.dialogChrome
    const settingsButton = comfyPage.page
      .getByTestId(TestIds.sidebar.toolbar)
      .getByRole('button', { name: /^Settings/ })
    await settingsButton.focus()
    await expect(settingsButton).toBeFocused()

    await chrome.openConfirm()
    await expect(chrome.dialogs).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(chrome.dialogs).toBeHidden()

    await expect(
      settingsButton,
      'focus must return to the element that was focused before the dialog opened'
    ).toBeFocused()
  })

  test('closes only the top-most dialog on Escape', async ({ comfyPage }) => {
    const chrome = comfyPage.dialogChrome
    await comfyPage.settingDialog.open()
    await chrome.openConfirm()

    await expect(chrome.dialogs).toHaveCount(2)

    await comfyPage.page.keyboard.press('Escape')

    await expect(chrome.dialogs).toHaveCount(1)
    expect(
      await chrome.openDialogKeys(),
      'Escape dismissed the container dialog instead of only the top-most one'
    ).toEqual(['global-settings'])

    await comfyPage.page.keyboard.press('Escape')
    await expect(chrome.dialogs).toHaveCount(0)
  })

  test('stacks a later dialog above an earlier one', async ({ comfyPage }) => {
    const chrome = comfyPage.dialogChrome
    await comfyPage.settingDialog.open()
    await chrome.openConfirm()
    await expect(chrome.dialogs).toHaveCount(2)

    const [lower, upper] = await chrome.stackingOrder()
    expect(
      upper,
      'the dialog opened last must render above the one opened first'
    ).toBeGreaterThan(lower)
  })

  test('leaves the page interactive for a non-modal container dialog', async ({
    comfyPage
  }) => {
    const chrome = comfyPage.dialogChrome

    await comfyPage.settingDialog.open()
    await expect(comfyPage.settingDialog.root).toBeVisible()

    expect(
      await chrome.isPageInert(),
      'Settings is non-modal so that the nested PrimeVue dialogs it hosts keep pointer events'
    ).toBe(false)
  })

  test('stays open while a PrimeVue overlay inside it is used', async ({
    comfyPage
  }) => {
    const settings = comfyPage.settingDialog
    await settings.open()
    await settings.searchBox.fill('Use new menu')

    const settingRow = settings.root.locator(
      '[data-setting-id="Comfy.UseNewMenu"]'
    )
    await expect(settingRow).toBeVisible()

    const select = settingRow.getByRole('combobox')
    await expect(select).toBeVisible()
    await expect(select).toBeEnabled()

    // PrimeVue re-renders the filtered settings list, replacing the combobox
    // element, so the first click can land on a stale node.
    await expect(async () => {
      if ((await select.getAttribute('aria-expanded')) !== 'true')
        await select.click()
      await expect(select).toHaveAttribute('aria-expanded', 'true')
    }).toPass({ timeout: 20_000 })

    await expect(
      settings.root,
      'opening a body-portaled PrimeVue overlay must not read as an outside interaction'
    ).toBeVisible()

    await comfyPage.page.getByRole('option').first().click()

    await expect(
      settings.root,
      'clicking inside a body-portaled PrimeVue overlay must not dismiss the dialog'
    ).toBeVisible()
  })
})
