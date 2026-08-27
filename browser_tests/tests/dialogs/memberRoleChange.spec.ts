import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { Member } from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  CREATOR,
  DEFAULT_TEAM_MEMBERS,
  MEMBER_JANE,
  MEMBER_JOHN,
  VIEWER
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

// Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
// against fully mocked endpoints; `comfyPage` would try to reach the OSS
// devtools backend during setup.

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

async function openMembersTab(page: Page): Promise<Locator> {
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })

  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('nav').getByRole('button', { name: 'Members' }).click()

  const content = dialog.getByRole('main')
  await expect(content.getByText('4 of 30 members')).toBeVisible()
  return content
}

function memberRow(content: Locator, email: string): Locator {
  return content
    .locator('div.grid')
    .filter({ has: content.page().getByText(email, { exact: true }) })
}

function menuButton(row: Locator): Locator {
  return row.getByRole('button', { name: 'More Options' })
}

// Reka submenus open on real pointer travel or keyboard; Playwright's
// synthetic hover doesn't trigger the pointermove handler, so drive the
// subtrigger with ArrowRight instead.
async function openChangeRoleSubmenu(page: Page) {
  const trigger = page.getByRole('menuitem', { name: 'Change role' })
  await expect(trigger).toBeVisible()
  await trigger.press('ArrowRight')
  await expect(
    page.getByRole('menuitemradio', { name: 'Owner', exact: true })
  ).toBeVisible()
}

test.describe('Members plan gating', { tag: '@cloud' }, () => {
  test('personal workspace with a Team plan gets member management', async ({
    page
  }) => {
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      workspace('personal', 'owner')
    )
    const content = await openMembersTab(page)

    const inviteButton = content.getByRole('button', {
      name: 'Invite member'
    })
    await expect(inviteButton).toBeEnabled()
    await expect(
      content.getByRole('button', { name: 'Role', exact: true })
    ).toBeVisible()
    await expect(
      content.getByText(MEMBER_JANE.email, { exact: true })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Upgrade to Team' })
    ).toHaveCount(0)
    await expect(menuButton(memberRow(content, CREATOR.email))).toHaveCount(0)

    await inviteButton.click()
    await expect(
      page.getByRole('heading', {
        name: 'Invite members to this workspace'
      })
    ).toBeVisible()
  })
})

test.describe('Member role change (Members tab)', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('additional workspace creator has actions while self does not', async ({
    page
  }) => {
    const state = await new CloudWorkspaceMockHelper(page).setup()
    const content = await openMembersTab(page)
    const creatorRow = memberRow(content, CREATOR.email)

    await expect(
      menuButton(memberRow(content, MEMBER_JOHN.email))
    ).toBeVisible()
    await expect(
      menuButton(memberRow(content, MEMBER_JANE.email))
    ).toBeVisible()
    await expect(menuButton(creatorRow)).toBeVisible()
    await expect(menuButton(memberRow(content, VIEWER.email))).toHaveCount(0)

    await menuButton(creatorRow).click()
    await expect(
      page.getByRole('menuitem', { name: 'Change role' })
    ).toBeVisible()
    await page.getByRole('menuitem', { name: 'Remove member' }).click()
    await expect(page.getByText('Remove this member?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await menuButton(creatorRow).click()
    await openChangeRoleSubmenu(page)
    await page
      .getByRole('menuitemradio', { name: 'Member', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Demote Liz to member?' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Demote to member' }).click()

    await expect(creatorRow.getByText('Member', { exact: true })).toBeVisible()
    expect(state.patches).toEqual([
      {
        url: expect.stringContaining('/api/workspace/members/u-liz'),
        role: 'member'
      }
    ])
  })

  test('selecting the current role is a no-op', async ({ page }) => {
    const state = await new CloudWorkspaceMockHelper(page).setup()
    const content = await openMembersTab(page)

    const janeRow = memberRow(content, MEMBER_JANE.email)
    await menuButton(janeRow).click()
    await openChangeRoleSubmenu(page)

    // The current role is a checked radio item so assistive tech can announce
    // which role is active.
    await expect(
      page.getByRole('menuitemradio', { name: 'Member', exact: true })
    ).toHaveAttribute('aria-checked', 'true')
    await expect(
      page.getByRole('menuitemradio', { name: 'Owner', exact: true })
    ).toHaveAttribute('aria-checked', 'false')

    await page
      .getByRole('menuitemradio', { name: 'Member', exact: true })
      .click()

    await expect(page.getByRole('heading', { name: /an owner\?/ })).toHaveCount(
      0
    )
    expect(state.patches).toHaveLength(0)
  })

  test('promote dialog shows the Figma copy and cancelling keeps the role', async ({
    page
  }) => {
    const state = await new CloudWorkspaceMockHelper(page).setup()
    const content = await openMembersTab(page)

    const janeRow = memberRow(content, MEMBER_JANE.email)
    await menuButton(janeRow).click()
    await openChangeRoleSubmenu(page)
    await page
      .getByRole('menuitemradio', { name: 'Owner', exact: true })
      .click()

    await expect(
      page.getByRole('heading', { name: 'Make Jane an owner?' })
    ).toBeVisible()
    await expect(page.getByText("They'll be able to:")).toBeVisible()
    await expect(page.getByText('Add additional credits')).toBeVisible()
    await expect(
      page.getByText('Manage members, payment methods, and workspace settings')
    ).toBeVisible()
    await expect(
      page.getByText('Promote members and demote eligible owners.')
    ).toBeVisible()

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Make Jane an owner?' })
    ).toHaveCount(0)
    await expect(janeRow.getByText('Member', { exact: true })).toBeVisible()
    expect(state.patches).toHaveLength(0)
  })

  test('promoting a member re-sorts the row under the creator and stays demotable', async ({
    page
  }) => {
    const state = await new CloudWorkspaceMockHelper(page).setup()
    const content = await openMembersTab(page)

    const emails = content.getByText(/@test\.comfy\.org/)
    await expect(emails).toHaveText([
      CREATOR.email,
      VIEWER.email,
      MEMBER_JOHN.email,
      MEMBER_JANE.email
    ])

    const janeRow = memberRow(content, MEMBER_JANE.email)
    await menuButton(janeRow).click()
    await openChangeRoleSubmenu(page)
    await page
      .getByRole('menuitemradio', { name: 'Owner', exact: true })
      .click()
    await page.getByRole('button', { name: 'Make owner' }).click()

    await expect(page.getByText('Role updated')).toBeVisible()
    await expect(janeRow.getByText('Owner', { exact: true })).toBeVisible()
    await expect(emails).toHaveText([
      CREATOR.email,
      VIEWER.email,
      MEMBER_JANE.email,
      MEMBER_JOHN.email
    ])
    expect(state.patches).toEqual([
      {
        url: expect.stringContaining('/api/workspace/members/u-jane'),
        role: 'owner'
      }
    ])

    // The promoted owner keeps its row menu (still demotable).
    await expect(menuButton(janeRow)).toBeVisible()
  })

  test('demoting an owner returns them to member', async ({ page }) => {
    const ownerJane: Member = { ...MEMBER_JANE, role: 'owner' }
    const state = await new CloudWorkspaceMockHelper(page).setup([
      CREATOR,
      VIEWER,
      ownerJane,
      MEMBER_JOHN
    ])
    const content = await openMembersTab(page)

    const janeRow = memberRow(content, MEMBER_JANE.email)
    await expect(janeRow.getByText('Owner', { exact: true })).toBeVisible()

    await menuButton(janeRow).click()
    await openChangeRoleSubmenu(page)
    await page
      .getByRole('menuitemradio', { name: 'Member', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Demote Jane to member?' })
    ).toBeVisible()
    await expect(page.getByText("They'll lose admin access.")).toBeVisible()
    await page.getByRole('button', { name: 'Demote to member' }).click()

    await expect(janeRow.getByText('Member', { exact: true })).toBeVisible()
    expect(state.patches).toEqual([
      {
        url: expect.stringContaining('/api/workspace/members/u-jane'),
        role: 'member'
      }
    ])
  })

  test('failed role change keeps the dialog open with an error toast', async ({
    page
  }) => {
    await new CloudWorkspaceMockHelper(page).setup()
    // Override the member route so PATCH fails after boot succeeds.
    await page.route('**/api/workspace/members/**', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, body: '{}' })
        : route.fallback()
    )
    const content = await openMembersTab(page)

    const janeRow = memberRow(content, MEMBER_JANE.email)
    await menuButton(janeRow).click()
    await openChangeRoleSubmenu(page)
    await page
      .getByRole('menuitemradio', { name: 'Owner', exact: true })
      .click()
    await page.getByRole('button', { name: 'Make owner' }).click()

    // US10 — error toast, dialog stays open, role unchanged.
    await expect(page.getByText('Failed to update role')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Make Jane an owner?' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(janeRow.getByText('Member', { exact: true })).toBeVisible()
  })
})
