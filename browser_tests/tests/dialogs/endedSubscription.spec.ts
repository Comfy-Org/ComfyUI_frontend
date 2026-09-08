import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import {
  DEFAULT_TEAM_MEMBERS,
  ENDED_STANDARD_BILLING_STATUS,
  INACTIVE_TEAM_BILLING_STATUS,
  TEAM_BILLING_STATUS,
  TEAM_MEMBER_WORKSPACE,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

test.describe('Ended workspace subscription', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })
  let content: Locator

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.open = (url) => {
        document.documentElement.dataset.openedUrl = String(url)
        return window
      }
    })
    const workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_WORKSPACE,
      ENDED_STANDARD_BILLING_STATUS
    )
    content = await workspace.openPlanAndCreditsSettings()
  })

  test('shows subscribe prompt instead of stale paid plan metadata', async ({
    page
  }) => {
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
    await expect(
      content.getByRole('button', { name: 'Invoice history' })
    ).toHaveCount(0)

    await content.getByRole('button', { name: 'Billing & invoices' }).click()
    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://billing.example/portal')
  })
})

test.describe('Inactive Team subscription billing', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })
  let content: Locator

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.open = (url) => {
        document.documentElement.dataset.openedUrl = String(url)
        return window
      }
    })
    const workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_WORKSPACE,
      INACTIVE_TEAM_BILLING_STATUS
    )
    content = await workspace.openPlanAndCreditsSettings()
  })

  test('keeps the owner billing portal available', async ({ page }) => {
    await expect(
      content.getByRole('heading', { name: 'Inactive team subscription' })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Reactivate plan' })
    ).toBeVisible()
    await content.getByRole('button', { name: 'Billing & invoices' }).click()
    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://billing.example/portal')
  })
})

test.describe('Team member billing permissions', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })
  let content: Locator

  test.beforeEach(async ({ page }) => {
    const workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_MEMBER_WORKSPACE,
      TEAM_BILLING_STATUS
    )
    content = await workspace.openPlanAndCreditsSettings()
  })

  test('does not expose owner billing actions', async () => {
    await expect(
      content.getByRole('heading', { name: 'Team', exact: true })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Billing & invoices' })
    ).toHaveCount(0)
    await expect(
      content.getByRole('button', { name: 'Invoice history' })
    ).toHaveCount(0)
  })
})
