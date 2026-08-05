import { expect } from '@playwright/test'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import {
  DEFAULT_TEAM_MEMBERS,
  ENDED_STANDARD_BILLING_STATUS,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Ended workspace subscription', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page }) => {
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_WORKSPACE,
      ENDED_STANDARD_BILLING_STATUS
    )
    await page.goto(process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188')
    await waitForCloudApp(page)

    await page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()
    const dialog = page.getByTestId(TestIds.dialogs.settings)
    await expect(dialog).toBeVisible()
    await dialog
      .locator('nav')
      .getByRole('button', { name: 'Workspace', exact: true })
      .click()
  })

  test('shows subscribe prompt instead of stale paid plan metadata', async ({
    page
  }) => {
    const content = page.getByTestId(TestIds.dialogs.settings).getByRole('main')

    await expect(
      content.getByRole('heading', {
        name: 'This workspace is not on a subscription'
      })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Subscribe Now' })
    ).toBeVisible()
    await expect(
      content.getByRole('heading', { name: 'Standard' })
    ).toHaveCount(0)
  })
})
