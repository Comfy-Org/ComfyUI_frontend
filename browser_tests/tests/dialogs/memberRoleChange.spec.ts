import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { Member } from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  CREATOR,
  MEMBER_JANE,
  MEMBER_JOHN,
  VIEWER
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

// Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
// against fully mocked endpoints; `comfyPage` would try to reach the OSS
// devtools backend during setup.

/**
 * Member role change (Settings ▸ Members) — Figma 2993-15512.
 *
 * The viewer is a promoted owner (not the workspace creator), so the spec can
 * distinguish the creator guard from the self guard: the creator row and the
 * viewer's own row hide the row menu, every other row exposes
 * "Change role ›" (Owner / Member) plus "Remove member". Promoting a member
 * sends PATCH /api/workspace/members/:id {role}, flips the Role column,
 * re-sorts the row under the creator, and the promoted owner stays demotable.
 */
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

test.describe('Member role change (Members tab)', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('row menus respect creator and self guards', async ({ page }) => {
    await new CloudWorkspaceMockHelper(page).setup()
    const content = await openMembersTab(page)

    // US8/US9 — no row actions on the creator row (Liz) nor on the viewer's
    // own row; the two plain members each expose a menu.
    await expect(
      menuButton(memberRow(content, MEMBER_JOHN.email))
    ).toBeVisible()
    await expect(
      menuButton(memberRow(content, MEMBER_JANE.email))
    ).toBeVisible()
    await expect(menuButton(memberRow(content, CREATOR.email))).toHaveCount(0)
    await expect(menuButton(memberRow(content, VIEWER.email))).toHaveCount(0)

    // US1/US12 — the row menu exposes Change role and the FE-768 remove flow.
    await menuButton(memberRow(content, MEMBER_JANE.email)).click()
    await expect(
      page.getByRole('menuitem', { name: 'Change role' })
    ).toBeVisible()
    await page.getByRole('menuitem', { name: 'Remove member' }).click()
    await expect(page.getByText('Remove this member?')).toBeVisible()
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
      page.getByText(
        'Promote and demote other owners (except the workspace creator).'
      )
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
