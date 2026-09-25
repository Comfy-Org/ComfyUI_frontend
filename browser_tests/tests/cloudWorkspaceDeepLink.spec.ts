import { expect } from '@playwright/test'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

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
 * A switch reloads the page from `onMounted`, before the app's own `ready`
 * event — and before the loading overlay hides, which happens even earlier
 * (once the graph bootstraps), so waiting on the overlay alone can resolve
 * on the pre-switch boot. Driving the deep link through `comfyPage`'s
 * `initialUrl` also races the fixture's own post-boot step for `@cloud`
 * tests (`setServerFlagsPersistent`) against that reload. Scenarios that
 * switch instead let the fixture finish its normal, non-deep-linked boot
 * first, then drive the deep link with a plain `page.goto` and explicitly
 * wait for the reload's own `load` event before checking app-ready.
 */
async function gotoAndWaitThroughSwitch(comfyPage: ComfyPage, path: string) {
  const page = comfyPage.page
  await page.goto(new URL(path, comfyPage.url).toString())
  await page.waitForEvent('load', { timeout: 30_000 })
  await comfyPage.waitForAppReady()
}

test.describe('Cloud workspace deep link', { tag: '@cloud' }, () => {
  test('switches into the workspace the link names', async ({ comfyPage }) => {
    const page = comfyPage.page

    await gotoAndWaitThroughSwitch(comfyPage, '/?workspace=ws-team')

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

    // No switch happens for an invalid link, so no further reload to wait
    // through — waiting for a second `load` event here would just run out
    // the test's own timeout, since that event never fires.
    await page.goto(
      new URL(
        '/?workspace=ws-team&workspace=ws-personal',
        comfyPage.url
      ).toString()
    )
    await comfyPage.waitForAppReady()

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

    await gotoAndWaitThroughSwitch(
      comfyPage,
      '/?workspace=ws-team&settings=plan-credits'
    )

    const dialog = page.getByTestId(TestIds.dialogs.settings)
    // Extra margin over the default 5s: this dialog opens from the *second*
    // boot after a full page reload, not a plain in-app state change.
    await expect(dialog).toBeVisible({ timeout: 15_000 })
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
