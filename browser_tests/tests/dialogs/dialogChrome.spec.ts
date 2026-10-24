import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { dialogChromeFixture } from '@e2e/fixtures/dialogChromeFixture'
import { TestIds } from '@e2e/fixtures/selectors'

const test = mergeTests(comfyPageFixture, dialogChromeFixture)

/**
 * Contract shared by every dialog rendered through `GlobalDialog`, exercised
 * against the core prompt/confirm dialogs and Settings. The behaviours here —
 * real focus movement, real stacking order, real pointer inertness — are the
 * ones jsdom cannot observe, so they are only meaningful in a browser.
 */
test.describe('Dialog chrome', { tag: '@ui' }, () => {
  test('moves focus onto the content autofocus target when opened', async ({
    comfyPage,
    dialogChrome
  }) => {
    await expect(comfyPage.canvas).toBeVisible()
    await dialogChrome.openPrompt()

    const dialog = dialogChrome.dialogs
    await expect(dialog).toBeVisible()
    await expect(
      dialog.locator('input[autofocus]'),
      'GlobalDialog focuses the [autofocus] target instead of the first tabbable element'
    ).toBeFocused()
  })

  test('keeps Tab focus inside a modal dialog', async ({
    comfyPage,
    dialogChrome
  }) => {
    await dialogChrome.openPrompt()
    const dialog = dialogChrome.dialogs
    await expect(dialog).toBeVisible()

    // Containment must hold after every press, so this asserts immediately
    // rather than polling — polling would let a transient escape recover
    // unnoticed, which is the regression the test exists to catch. Reka's
    // FocusScope handles Tab synchronously, so there is no race to lose.
    for (let press = 1; press <= 6; press++) {
      await comfyPage.page.keyboard.press('Tab')
      expect(
        await dialogChrome.isFocusInside(dialog),
        `focus escaped the modal dialog after ${press} Tab press(es)`
      ).toBe(true)
    }
  })

  test('makes the page pointer-inert while a modal dialog is open', async ({
    comfyPage,
    dialogChrome
  }) => {
    expect(await dialogChrome.isPageInert()).toBe(false)

    await dialogChrome.openPrompt()
    await expect(dialogChrome.dialogs).toBeVisible()
    await expect.poll(() => dialogChrome.isPageInert()).toBe(true)

    await comfyPage.page.keyboard.press('Escape')
    await expect(dialogChrome.dialogs).toBeHidden()
    await expect
      .poll(() => dialogChrome.isPageInert(), {
        message: 'page stayed inert after the modal dialog closed'
      })
      .toBe(false)
  })

  test('restores focus to the previously focused element when closed', async ({
    comfyPage,
    dialogChrome
  }) => {
    const settingsButton = comfyPage.page
      .getByTestId(TestIds.sidebar.toolbar)
      .getByRole('button', { name: /^Settings/ })
    await settingsButton.focus()
    await expect(settingsButton).toBeFocused()

    await dialogChrome.openConfirm()
    await expect(dialogChrome.dialogs).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(dialogChrome.dialogs).toBeHidden()

    await expect(
      settingsButton,
      'focus must return to the element that was focused before the dialog opened'
    ).toBeFocused()
  })

  test('closes only the top-most dialog on Escape', async ({
    comfyPage,
    dialogChrome
  }) => {
    await comfyPage.settingDialog.open()
    await dialogChrome.openConfirm()

    await expect(dialogChrome.dialogs).toHaveCount(2)

    await comfyPage.page.keyboard.press('Escape')

    await expect(dialogChrome.dialogs).toHaveCount(1)
    expect(
      await dialogChrome.openDialogKeys(),
      'Escape dismissed the container dialog instead of only the top-most one'
    ).toEqual(['global-settings'])

    await comfyPage.page.keyboard.press('Escape')
    await expect(dialogChrome.dialogs).toHaveCount(0)
  })

  test('stacks a later dialog above an earlier one', async ({
    comfyPage,
    dialogChrome
  }) => {
    await comfyPage.settingDialog.open()
    await dialogChrome.openConfirm()
    await expect(dialogChrome.dialogs).toHaveCount(2)
    await expect(
      dialogChrome.overlays,
      'each stacked dialog renders its own scrim'
    ).toHaveCount(2)

    const [lower, upper] = await dialogChrome.stackingOrder()
    expect(
      upper,
      'the dialog opened last must render above the one opened first'
    ).toBeGreaterThan(lower)
  })

  test('leaves the page interactive for a non-modal container dialog', async ({
    comfyPage,
    dialogChrome
  }) => {
    await comfyPage.settingDialog.open()
    await expect(comfyPage.settingDialog.root).toBeVisible()

    expect(
      await dialogChrome.isPageInert(),
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
    }).toPass({ timeout: 10_000 })

    await expect(
      settings.root,
      'opening a body-portaled PrimeVue overlay must not read as an outside interaction'
    ).toBeVisible()

    // Re-selecting the current value keeps the assertion about the overlay
    // interaction rather than about changing a persisted setting.
    await comfyPage.page
      .getByRole('option', { name: 'Top', exact: true })
      .click()

    await expect(
      settings.root,
      'clicking inside a body-portaled PrimeVue overlay must not dismiss the dialog'
    ).toBeVisible()
  })
})
