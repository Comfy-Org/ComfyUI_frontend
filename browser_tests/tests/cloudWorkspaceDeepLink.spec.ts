import { expect } from '@playwright/test'

import {
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME
} from '@e2e/fixtures/data/workspaceSwitcher'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspaceSwitcherTest as test } from '@e2e/fixtures/workspaceSwitcherFixture'

/**
 * Cloud app support for `?workspace=` deep links
 * (`@comfyorg/account-core/workspaceLink`). Boots against the
 * workspace-switcher fixture: `ws-personal` (owner) and `ws-team` (owner) are
 * both real memberships; any other id is not a member.
 *
 * A member switch reloads the page from `onMounted`, before the app's own
 * `ready` event — the fixture's initial `waitForAppReady()` (run as part of
 * `comfyPage.setup()`, before the test body starts) can return early: it
 * treats the loading overlay's element being torn out by that navigation as
 * "hidden", not as the app having actually finished the *second* boot. Every
 * test whose deep link is expected to switch (and therefore reload) starts
 * by waiting for app-ready again, the same way `workspaceSwitcher.spec.ts`
 * re-waits after a user-triggered switch.
 */
test.describe('Cloud workspace deep link', { tag: '@cloud' }, () => {
  test.describe('member workspace', () => {
    test.use({ initialUrl: '/?workspace=ws-team' })

    test('switches into the workspace the link names', async ({
      comfyPage
    }) => {
      await comfyPage.waitForAppReady()
      const page = comfyPage.page

      await page.getByRole('button', { name: 'Current user' }).click()
      await expect(
        page.getByTestId('workspace-switcher-trigger')
      ).toContainText(TEAM_WORKSPACE_NAME)
      expect(new URL(page.url()).searchParams.has('workspace')).toBe(false)
    })
  })

  test.describe('non-member workspace', () => {
    test.use({ initialUrl: '/?workspace=ws-not-a-member' })

    test('stays on the active workspace and explains why', async ({
      comfyPage
    }) => {
      const page = comfyPage.page

      await expect(
        page.getByText(`You're still in ${PERSONAL_WORKSPACE_NAME}`)
      ).toBeVisible()
      expect(new URL(page.url()).searchParams.has('workspace')).toBe(false)

      await page.getByRole('button', { name: 'Current user' }).click()
      await expect(
        page.getByTestId('workspace-switcher-trigger')
      ).toContainText(PERSONAL_WORKSPACE_NAME)
    })
  })

  test.describe('invalid link', () => {
    test.use({ initialUrl: '/?workspace=ws-team&workspace=ws-personal' })

    test('stays on the active workspace and explains why', async ({
      comfyPage
    }) => {
      const page = comfyPage.page

      await expect(
        page.getByText(`You're still in ${PERSONAL_WORKSPACE_NAME}`)
      ).toBeVisible()
      expect(new URL(page.url()).searchParams.has('workspace')).toBe(false)
    })
  })

  test('is unchanged with no workspace param', async ({ comfyPage }) => {
    const page = comfyPage.page

    await expect(page.locator('.p-toast-message:visible')).toHaveCount(0)
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
      PERSONAL_WORKSPACE_NAME
    )
  })

  test.describe('combined with a settings deep link', () => {
    test.use({ initialUrl: '/?workspace=ws-team&settings=plan-credits' })

    test('opens Settings on the requested workspace', async ({ comfyPage }) => {
      await comfyPage.waitForAppReady()
      const page = comfyPage.page

      const dialog = page.getByTestId(TestIds.dialogs.settings)
      await expect(dialog).toBeVisible()
      const url = new URL(page.url())
      expect(url.searchParams.has('workspace')).toBe(false)
      expect(url.searchParams.has('settings')).toBe(false)

      await dialog.getByLabel('Close').click()
      await page.getByRole('button', { name: 'Current user' }).click()
      await expect(
        page.getByTestId('workspace-switcher-trigger')
      ).toContainText(TEAM_WORKSPACE_NAME)
    })
  })
})
