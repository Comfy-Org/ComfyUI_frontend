import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

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
 * Scenarios that switch workspace reload the page from `onMounted`, before
 * the app's own `ready` event. Driving that deep link through
 * `comfyPage`'s `initialUrl` races two fixture-internal steps against that
 * reload: `waitForAppReady()`'s overlay-hidden wait can be satisfied by an
 * *earlier*, legitimate hide (the loading overlay hides once the graph
 * bootstraps, before `runUrlActionLoaders` runs), and the very next fixture
 * step for `@cloud` tests (`setServerFlagsPersistent`) then runs
 * `page.evaluate` right as the reload tears down `window.app`. Those
 * scenarios instead let the fixture finish its normal, non-deep-linked boot
 * first, then drive the deep link with a plain `page.goto` from inside the
 * test body and wait for the *specific* combined condition that proves the
 * app is done — not merely that the overlay element is momentarily gone.
 */

/** Waits past a workspace-switch reload: `window.app` must exist AND the
 * loading overlay must be hidden, checked together in one poll so a
 * mid-navigation moment (where the overlay is briefly absent from a blank
 * document) can't satisfy it on its own. */
async function waitForFinalAppReady(page: Page) {
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector(
        '[data-testid="app-loading-overlay"]'
      )
      const overlayHidden =
        !overlay || getComputedStyle(overlay).display === 'none'
      return Boolean(window.app?.extensionManager) && overlayHidden
    },
    null,
    { timeout: 60_000 }
  )
}

test.describe('Cloud workspace deep link', { tag: '@cloud' }, () => {
  test('switches into the workspace the link names', async ({ comfyPage }) => {
    const page = comfyPage.page

    await page.goto(new URL('/?workspace=ws-team', comfyPage.url).toString())
    await waitForFinalAppReady(page)

    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
      TEAM_WORKSPACE_NAME
    )
    expect(new URL(page.url()).searchParams.has('workspace')).toBe(false)
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

  test('stays on the active workspace and explains why for an invalid link', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await page.goto(
      new URL(
        '/?workspace=ws-team&workspace=ws-personal',
        comfyPage.url
      ).toString()
    )
    await waitForFinalAppReady(page)

    await expect(
      page.getByText(`You're still in ${PERSONAL_WORKSPACE_NAME}`)
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.has('workspace')).toBe(false)
  })

  test('is unchanged with no workspace param', async ({ comfyPage }) => {
    const page = comfyPage.page

    await expect(page.locator('.p-toast-message:visible')).toHaveCount(0)
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
      PERSONAL_WORKSPACE_NAME
    )
  })

  test('opens Settings on the requested workspace from a combined deep link', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await page.goto(
      new URL(
        '/?workspace=ws-team&settings=plan-credits',
        comfyPage.url
      ).toString()
    )
    await waitForFinalAppReady(page)

    const dialog = page.getByTestId(TestIds.dialogs.settings)
    await expect(dialog).toBeVisible()
    const url = new URL(page.url())
    expect(url.searchParams.has('workspace')).toBe(false)
    expect(url.searchParams.has('settings')).toBe(false)

    await dialog.getByLabel('Close').click()
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
      TEAM_WORKSPACE_NAME
    )
  })
})
