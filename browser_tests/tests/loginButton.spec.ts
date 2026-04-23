import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Enable the show_signin_button server feature flag so LoginButton renders
 * in WorkflowTabs (which uses `flags.showSignInButton ?? isDesktop`).
 * The flag is reset automatically on each fresh page load in beforeEach.
 */
async function enableLoginButtonFlag(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.app!.api.serverFeatureFlags.value = {
      ...window.app!.api.serverFeatureFlags.value,
      show_signin_button: true
    }
  })
}

test.describe('Login Button', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setup()
  })

  test.describe('Visibility', () => {
    test('button is hidden when show_signin_button flag is off', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(() => {
        window.app!.api.serverFeatureFlags.value = {
          ...window.app!.api.serverFeatureFlags.value,
          show_signin_button: false
        }
      })
      await expect(
        comfyPage.page.getByTestId(TestIds.topbar.loginButton)
      ).toBeHidden()
    })

    test('button is visible when show_signin_button flag is enabled', async ({
      comfyPage
    }) => {
      await enableLoginButtonFlag(comfyPage.page)
      await expect(
        comfyPage.page.getByTestId(TestIds.topbar.loginButton)
      ).toBeVisible()
    })
  })

  test.describe('ARIA', () => {
    test('button has correct aria-label', async ({ comfyPage }) => {
      await enableLoginButtonFlag(comfyPage.page)
      const button = comfyPage.page.getByTestId(TestIds.topbar.loginButton)
      await expect(button).toHaveAttribute('aria-label', /.+/)
    })
  })

  test.describe('Click behaviour', () => {
    test('clicking the button opens the sign-in dialog', async ({
      comfyPage
    }) => {
      await enableLoginButtonFlag(comfyPage.page)
      const dialog = new SignInDialog(comfyPage.page)
      await comfyPage.page.getByTestId(TestIds.topbar.loginButton).click()
      await expect(dialog.root).toBeVisible()
    })
  })

  test.describe('Hover popover', () => {
    test('hovering shows an informational popover', async ({ comfyPage }) => {
      await enableLoginButtonFlag(comfyPage.page)
      await comfyPage.page.getByTestId(TestIds.topbar.loginButton).hover()
      await expect(
        comfyPage.page.getByText('Login to be able to use "API Nodes"')
      ).toBeVisible()
    })

    test('popover contains a Learn more link', async ({ comfyPage }) => {
      await enableLoginButtonFlag(comfyPage.page)
      await comfyPage.page.getByTestId(TestIds.topbar.loginButton).hover()
      const learnMoreLink = comfyPage.page.getByRole('link', {
        name: 'Learn more...'
      })
      await expect(learnMoreLink).toBeVisible()
      await expect(learnMoreLink).toHaveAttribute('href', /api-nodes/)
    })

    test('popover hides after mouse leaves the button area', async ({
      comfyPage
    }) => {
      await enableLoginButtonFlag(comfyPage.page)
      const button = comfyPage.page.getByTestId(TestIds.topbar.loginButton)
      await button.hover()
      await expect(
        comfyPage.page.getByText('Login to be able to use "API Nodes"')
      ).toBeVisible()

      await comfyPage.page.mouse.move(0, 0)
      await expect(
        comfyPage.page.getByText('Login to be able to use "API Nodes"')
      ).toBeHidden()
    })
  })
})
