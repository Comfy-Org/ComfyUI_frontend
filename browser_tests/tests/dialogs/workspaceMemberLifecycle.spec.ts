import { expect } from '@playwright/test'
import type { Locator, Page, Route } from '@playwright/test'
import type {
  CreateInviteRequest,
  ErrorResponse,
  PendingInvite
} from '@comfyorg/ingest-types'

import type {
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  CREATOR,
  DEFAULT_TEAM_MEMBERS,
  TEAM_WORKSPACE,
  VIEWER
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const MAX_TEAM_MEMBERS = 30

async function openMembersTab(
  page: Page,
  expectedMemberCount: number
): Promise<Locator> {
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
  await dialog.locator('nav').getByRole('button', { name: 'Workspace' }).click()

  const content = dialog.getByRole('main')
  await content.getByRole('tab', { name: /Members/ }).click()
  await expect(
    content.getByText(`${expectedMemberCount} of ${MAX_TEAM_MEMBERS} members`, {
      exact: true
    })
  ).toBeVisible()
  return content
}

function membersAtCapacity(): Member[] {
  return [
    CREATOR,
    VIEWER,
    ...Array.from(
      { length: MAX_TEAM_MEMBERS - 2 },
      (_, index): Member => ({
        id: `u-capacity-${index}`,
        name: `Capacity Member ${index}`,
        email: `capacity-${index}@test.comfy.org`,
        joined_at: `2025-02-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
        role: 'member',
        is_original_owner: false
      })
    )
  ]
}

async function fulfillJson<T>(
  route: Route,
  body: T,
  status = 200
): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  })
}

test.describe('Workspace member request contracts', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-07 invite UI posts one email and displays the returned pending invite', async ({
    page
  }) => {
    const email = 'new.member@test.comfy.org'
    const inviteResponse: PendingInvite = {
      id: 'invite-new-member',
      email,
      token: 'invite-token',
      invited_at: '2025-02-01T00:00:00Z',
      expires_at: '2099-02-08T00:00:00Z'
    }
    let inviteRequest: CreateInviteRequest | undefined

    await new CloudWorkspaceMockHelper(page).setup()
    await page.route('**/api/workspace/invites', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      inviteRequest = route.request().postDataJSON() as CreateInviteRequest
      await fulfillJson(route, inviteResponse)
    })
    const content = await openMembersTab(page, DEFAULT_TEAM_MEMBERS.length)

    await content
      .getByRole('button', { name: 'Invite member', exact: true })
      .click()
    await page.getByPlaceholder('Enter emails separated by commas').fill(email)
    await page
      .getByPlaceholder('Enter emails separated by commas')
      .press('Enter')
    await page.getByRole('button', { name: 'Invite', exact: true }).click()

    await expect(
      page.getByText(`An invite was sent to ${email}`, { exact: true })
    ).toBeVisible()
    expect(inviteRequest).toEqual({ email })

    await page
      .getByRole('button', { name: 'Close', exact: true })
      .filter({ hasText: 'Close' })
      .click()
    await content.getByRole('button', { name: 'Pending (1)' }).click()
    await expect(
      content.getByText('1 pending invite', { exact: true })
    ).toBeVisible()
    await expect(content.getByText(email, { exact: true })).toBeVisible()
  })

  test('TB-08 member UI shows the team seat count and disables invites at capacity', async ({
    page
  }) => {
    await new CloudWorkspaceMockHelper(page).setup(membersAtCapacity())
    const content = await openMembersTab(page, MAX_TEAM_MEMBERS)

    await expect(
      content.getByRole('button', { name: 'Invite member', exact: true })
    ).toBeDisabled()
  })

  test('TB-08 removal UI sends DELETE and removes the targeted member row', async ({
    page
  }) => {
    const removedMember = DEFAULT_TEAM_MEMBERS.at(-1)
    if (!removedMember) throw new Error('Expected a removable team member')

    await new CloudWorkspaceMockHelper(page).setup()
    await page.route(
      `**/api/workspace/members/${removedMember.id}`,
      async (route) => {
        if (route.request().method() !== 'DELETE') return route.fallback()
        await route.fulfill({ status: 204 })
      }
    )
    const content = await openMembersTab(page, DEFAULT_TEAM_MEMBERS.length)
    const row = content.getByTestId(`member-row-${removedMember.id}`)
    const removeRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'DELETE' &&
        new URL(request.url()).pathname.endsWith(
          `/api/workspace/members/${removedMember.id}`
        )
    )

    await row.getByRole('button', { name: 'More Options' }).click()
    await page.getByRole('menuitem', { name: 'Remove member' }).click()
    await page
      .getByRole('button', { name: 'Remove member', exact: true })
      .click()

    const removeRequest = await removeRequestPromise
    expect(removeRequest.method()).toBe('DELETE')
    await expect(
      page.getByText('Member removed', { exact: true })
    ).toBeVisible()
    await expect(row).toHaveCount(0)
    await expect(
      content.getByText(
        `${DEFAULT_TEAM_MEMBERS.length - 1} of ${MAX_TEAM_MEMBERS} members`,
        { exact: true }
      )
    ).toBeVisible()
  })

  test('TB-10 member role UI omits invite and member-removal controls', async ({
    page
  }) => {
    const memberWorkspace: WorkspaceWithRole = {
      ...TEAM_WORKSPACE,
      role: 'member'
    }
    const members = DEFAULT_TEAM_MEMBERS.map((member) =>
      member.id === VIEWER.id ? { ...member, role: 'member' as const } : member
    )

    await new CloudWorkspaceMockHelper(page).setup(members, memberWorkspace)
    const content = await openMembersTab(page, members.length)

    await expect(
      content.getByRole('button', { name: 'Invite member', exact: true })
    ).toHaveCount(0)
    await expect(
      content
        .locator('[data-testid^="member-row-"]')
        .getByRole('button', { name: 'More Options' })
    ).toHaveCount(0)
    await expect(content.getByRole('button', { name: /^Pending/ })).toHaveCount(
      0
    )
  })

  test('TB-07 failed invite request keeps the email retryable', async ({
    page
  }) => {
    const email = 'retry.member@test.comfy.org'
    const errorResponse: ErrorResponse = {
      code: 'invite_service_unavailable',
      message: 'Invite service unavailable'
    }

    await new CloudWorkspaceMockHelper(page).setup()
    await page.route('**/api/workspace/invites', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await fulfillJson(route, errorResponse, 503)
    })
    const content = await openMembersTab(page, DEFAULT_TEAM_MEMBERS.length)

    await content
      .getByRole('button', { name: 'Invite member', exact: true })
      .click()
    const emailInput = page.getByPlaceholder('Enter emails separated by commas')
    await emailInput.fill(email)
    await emailInput.press('Enter')
    await page.getByRole('button', { name: 'Invite', exact: true }).click()

    await expect(
      page.getByText("Couldn't send 1 invite. Try again.", { exact: true })
    ).toBeVisible()
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Invite members to this workspace'
      })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Invite', exact: true })
    ).toBeEnabled()
  })
})
