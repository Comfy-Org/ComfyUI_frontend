import type { PendingInvite } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import type { Member } from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { MembersSettingsPanel } from '@e2e/fixtures/components/MembersSettingsPanel'
import {
  CREATOR,
  DEFAULT_TEAM_MEMBERS,
  MEMBER_JANE,
  MEMBER_JOHN,
  TEAM_BILLING_STATUS,
  TEAM_WORKSPACE,
  TEAM_MEMBER_WORKSPACE,
  VIEWER
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
// against fully mocked endpoints; `comfyPage` would try to reach the OSS
// devtools backend during setup.

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

test.describe('Members plan gating', { tag: '@cloud' }, () => {
  test('full workspace keeps member and pending-invite management', async ({
    page,
    toast
  }) => {
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_WORKSPACE,
      { ...TEAM_BILLING_STATUS, occupied_seats: 30 },
      {
        can_manage_members: true,
        can_invite_members: false,
        can_change_seats: false
      }
    )
    const invites: PendingInvite[] = Array.from({ length: 26 }, (_, index) => ({
      id: `invite-${index}`,
      email: `pending-${index}@test.comfy.org`,
      invited_at: '2026-01-01T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
      token: `token-${index}`
    }))
    await page.route('**/api/workspace/invites', (route) =>
      route.fulfill(jsonRoute({ invites }))
    )
    await page.route('**/api/workspace/invites/invite-0/resend', (route) =>
      route.fulfill(jsonRoute(invites[0]))
    )
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)

    await expect(
      members.content.getByRole('button', { name: 'Invite member' })
    ).toHaveCount(0)
    await members.menuButton(members.memberRow(MEMBER_JANE.email)).click()
    await members.openChangeRoleSubmenu()
    await page
      .getByRole('menuitemradio', { name: 'Owner', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Make Jane an owner?' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await members.content.getByRole('button', { name: 'Pending (26)' }).click()
    const inviteRow = members.memberRow(invites[0].email)
    await expect(inviteRow).toBeVisible()
    await members.menuButton(inviteRow).click()
    await page.getByRole('menuitem', { name: 'Resend invite' }).click()
    await expect(toast.withText('Invite resent')).toBeVisible()
    await members.menuButton(inviteRow).click()
    await page.getByRole('menuitem', { name: 'Cancel invite' }).click()
    await expect(
      page.getByRole('heading', { name: 'Uninvite this person?' })
    ).toBeVisible()
  })

  test('team member can view and search the returned roster without management controls', async ({
    page
  }) => {
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS.map((member) =>
        member.id === VIEWER.id ? { ...member, role: 'member' } : member
      ),
      TEAM_MEMBER_WORKSPACE,
      TEAM_BILLING_STATUS,
      { can_manage_members: false, can_invite_members: false }
    )
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)
    const { content } = members

    await expect(
      content.getByText(MEMBER_JANE.email, { exact: true })
    ).toBeVisible()
    await expect(content.getByText('Role', { exact: true })).toBeVisible()
    await expect(content.getByRole('button', { name: /^Pending/ })).toHaveCount(
      0
    )
    await expect(
      content.getByRole('button', { name: 'Invite member' })
    ).toHaveCount(0)
    await expect(
      members.menuButton(members.memberRow(MEMBER_JANE.email))
    ).toHaveCount(0)
    const search = content.getByRole('combobox')
    await expect(search).toBeVisible()
    await search.fill(MEMBER_JANE.email)
    await expect(
      content.getByText(MEMBER_JANE.email, { exact: true })
    ).toBeVisible()
    await expect(
      content.getByText(MEMBER_JOHN.email, { exact: true })
    ).toHaveCount(0)
  })

  test('personal workspace with a Team plan gets member management', async ({
    page
  }) => {
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      workspace('personal', 'owner')
    )
    const invite: PendingInvite = {
      id: 'personal-invite',
      email: 'personal-pending@test.comfy.org',
      invited_at: '2026-01-01T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
      token: 'personal-invite-token'
    }
    await page.route('**/api/workspace/invites', (route) =>
      route.fulfill(jsonRoute({ invites: [invite] }))
    )
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)
    const { content } = members

    const inviteButton = content.getByRole('button', {
      name: 'Invite member'
    })
    await expect(inviteButton).toBeEnabled()
    await expect(content.getByText('Role', { exact: true })).toBeVisible()
    await expect(
      content.getByText(MEMBER_JANE.email, { exact: true })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Upgrade to Team' })
    ).toHaveCount(0)
    await expect(
      members.menuButton(members.memberRow(CREATOR.email))
    ).toHaveCount(0)

    await content.getByRole('button', { name: 'Pending (1)' }).click()
    await expect(content.getByText(invite.email, { exact: true })).toBeVisible()

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
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)
    const creatorRow = members.memberRow(CREATOR.email)

    await expect(
      members.menuButton(members.memberRow(MEMBER_JOHN.email))
    ).toBeVisible()
    await expect(
      members.menuButton(members.memberRow(MEMBER_JANE.email))
    ).toBeVisible()
    await expect(members.menuButton(creatorRow)).toBeVisible()
    await expect(
      members.menuButton(members.memberRow(VIEWER.email))
    ).toHaveCount(0)

    await members.menuButton(creatorRow).click()
    await expect(
      page.getByRole('menuitem', { name: 'Change role' })
    ).toBeVisible()
    await page.getByRole('menuitem', { name: 'Remove member' }).click()
    await expect(page.getByText('Remove this member?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await members.menuButton(creatorRow).click()
    await members.openChangeRoleSubmenu()
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
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)

    const janeRow = members.memberRow(MEMBER_JANE.email)
    await members.menuButton(janeRow).click()
    await members.openChangeRoleSubmenu()

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
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)

    const janeRow = members.memberRow(MEMBER_JANE.email)
    await members.menuButton(janeRow).click()
    await members.openChangeRoleSubmenu()
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
    page,
    toast
  }) => {
    const state = await new CloudWorkspaceMockHelper(page).setup()
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)
    const { content } = members

    const emails = content.getByText(/@test\.comfy\.org/)
    await expect(emails).toHaveText([
      CREATOR.email,
      VIEWER.email,
      MEMBER_JOHN.email,
      MEMBER_JANE.email
    ])

    const janeRow = members.memberRow(MEMBER_JANE.email)
    await members.menuButton(janeRow).click()
    await members.openChangeRoleSubmenu()
    await page
      .getByRole('menuitemradio', { name: 'Owner', exact: true })
      .click()
    await page.getByRole('button', { name: 'Make owner' }).click()

    await expect(toast.withText('Role updated')).toBeVisible()
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
    await expect(members.menuButton(janeRow)).toBeVisible()
  })

  test('demoting an owner returns them to member', async ({ page }) => {
    const ownerJane: Member = { ...MEMBER_JANE, role: 'owner' }
    const state = await new CloudWorkspaceMockHelper(page).setup([
      CREATOR,
      VIEWER,
      ownerJane,
      MEMBER_JOHN
    ])
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)

    const janeRow = members.memberRow(MEMBER_JANE.email)
    await expect(janeRow.getByText('Owner', { exact: true })).toBeVisible()

    await members.menuButton(janeRow).click()
    await members.openChangeRoleSubmenu()
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
    page,
    toast
  }) => {
    await new CloudWorkspaceMockHelper(page).setup()
    // Override the member route so PATCH fails after boot succeeds.
    await page.route('**/api/workspace/members/**', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, body: '{}' })
        : route.fallback()
    )
    const members = new MembersSettingsPanel(page)
    await members.open(APP_URL)

    const janeRow = members.memberRow(MEMBER_JANE.email)
    await members.menuButton(janeRow).click()
    await members.openChangeRoleSubmenu()
    await page
      .getByRole('menuitemradio', { name: 'Owner', exact: true })
      .click()
    await page.getByRole('button', { name: 'Make owner' }).click()

    // US10 — error toast, dialog stays open, role unchanged.
    await expect(
      toast.toastErrors.filter({
        hasText: 'Failed to update role'
      })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Make Jane an owner?' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(janeRow.getByText('Member', { exact: true })).toBeVisible()
  })
})
