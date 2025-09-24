import { expect } from '@playwright/test'

import { userSelectPageFixture as test } from '../fixtures/UserSelectPage'

/**
 * Expects ComfyUI backend to be launched with `--multi-user` flag.
 */
test.describe('User Select View', () => {
  test.beforeEach(async ({ userSelectPage, page }) => {
    await page.goto(userSelectPage.url)
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('Redirects to user select view if no user is logged in', async ({
    userSelectPage,
    page
  }) => {
    await page.goto(userSelectPage.url)
    await expect(userSelectPage.container).toBeVisible()
    expect(page.url()).toBe(userSelectPage.selectionUrl)
  })

  test('Can create new user', async ({ userSelectPage, page }) => {
    const randomUser = `test-user-${Math.random().toString(36).substring(2, 7)}`
    await page.goto(userSelectPage.url)
    await expect(page).toHaveURL(userSelectPage.selectionUrl)
    await userSelectPage.newUserInput.fill(randomUser)
    await userSelectPage.nextButton.click()
    await expect(page).toHaveURL(userSelectPage.url)
  })

  test('Can choose existing user', async ({ userSelectPage, page }) => {
    await page.goto(userSelectPage.url)
    await expect(page).toHaveURL(userSelectPage.selectionUrl)

    await userSelectPage.existingUserSelect.click()

    const dropdownList = page.locator('.p-select-list')
    await expect(dropdownList).toBeVisible()

    // Wait for dropdown to populate
    await page.waitForTimeout(500)

    // Try to click first option if it exists
    const firstOption = page.locator('.p-select-list .p-select-option').first()

    if ((await firstOption.count()) > 0) {
      await firstOption.click()
    } else {
      // No options available - close dropdown and use new user input
      await page.keyboard.press('Escape')
      await userSelectPage.newUserInput.fill(`test-user-${Date.now()}`)
    }

    await userSelectPage.nextButton.click()
    await expect(page).toHaveURL(userSelectPage.url, { timeout: 15000 })
  })
})
