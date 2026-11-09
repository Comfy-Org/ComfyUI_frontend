import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { LoginButton } from '@e2e/fixtures/components/LoginButton'
import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Login Button', { tag: ['@ui'] }, () => {
  test.describe('Visibility', () => {
    test('button is visible', async ({ comfyPage }) => {
      await expect(
        comfyPage.page.getByTestId(TestIds.topbar.loginButton)
      ).toBeVisible()
    })
  })

  test.describe('ARIA', () => {
    test('button has correct aria-label', async ({ comfyPage }) => {
      const button = comfyPage.page.getByTestId(TestIds.topbar.loginButton)
      await expect(button).toHaveAttribute('aria-label', /.+/)
    })
  })

  test.describe('Click behaviour', () => {
    test('clicking the button opens the sign-in dialog', async ({
      comfyPage
    }) => {
      const dialog = new SignInDialog(comfyPage.page)
      await comfyPage.page.getByTestId(TestIds.topbar.loginButton).click()
      await expect(dialog.root).toBeVisible()
    })
  })

  test.describe('Hover popover', () => {
    test('hovering shows an informational popover', async ({ comfyPage }) => {
      await comfyPage.page.getByTestId(TestIds.topbar.loginButton).hover()
      await expect(
        comfyPage.page.getByTestId(TestIds.topbar.loginButtonPopover)
      ).toBeVisible()
    })

    test('popover contains a Learn more link', async ({ comfyPage }) => {
      await comfyPage.page.getByTestId(TestIds.topbar.loginButton).hover()
      const learnMoreLink = comfyPage.page.getByTestId(
        TestIds.topbar.loginButtonPopoverLearnMore
      )
      await expect(learnMoreLink).toBeVisible()
      await expect(learnMoreLink).toHaveAttribute('href', /api-nodes/)
    })

    test('popover hides after mouse leaves the button area', async ({
      comfyPage
    }) => {
      const button = comfyPage.page.getByTestId(TestIds.topbar.loginButton)
      await button.hover()
      await expect(
        comfyPage.page.getByTestId(TestIds.topbar.loginButtonPopover)
      ).toBeVisible()

      await comfyPage.canvas.hover()
      await expect(
        comfyPage.page.getByTestId(TestIds.topbar.loginButtonPopover)
      ).toBeHidden()
    })

    test('closing a hover popover preserves text input focus', async ({
      comfyPage
    }) => {
      const login = new LoginButton(comfyPage.page)
      const sidebar = comfyPage.menu.nodeLibraryTabV2

      await test.step('Focus the sidebar search', async () => {
        await sidebar.open()
        await sidebar.searchInput.focus()
        await expect(sidebar.searchInput).toBeFocused()
      })

      await test.step('Hover login and then move back to the search', async () => {
        await login.hover()
        await expect(sidebar.searchInput).toBeFocused()
        await sidebar.searchInput.hover()
        await expect(login.popover).toBeHidden()
        await expect(sidebar.searchInput).toBeFocused()
      })
    })
  })
})
