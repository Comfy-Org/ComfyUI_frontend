import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type {
  BillingStatusResponse,
  Member,
  Plan,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'

// Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
// against fully mocked endpoints; `comfyPage` would try to reach the OSS
// devtools backend during setup.

/**
 * Member role change (Settings ▸ Workspace ▸ Members) — FE-770 / Figma
 * 2993-15512.
 *
 * The viewer is a promoted owner (not the workspace creator), so the spec can
 * distinguish the creator guard from the self guard: the creator row and the
 * viewer's own row hide the row menu, every other row exposes
 * "Change role ›" (Owner / Member) plus "Remove member". Promoting a member
 * sends PATCH /api/workspace/members/:id {role}, flips the Role column,
 * re-sorts the row under the creator, and the promoted owner stays demotable.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

const CREATOR: Member = {
  id: 'u-liz',
  name: 'Liz',
  email: 'liz@test.comfy.org',
  joined_at: '2025-01-01T00:00:00Z',
  role: 'owner'
}
// Matches the CloudAuthHelper mock user so this row counts as "(You)".
const VIEWER: Member = {
  id: 'u-me',
  name: 'E2E Test User',
  email: 'e2e@test.comfy.org',
  joined_at: '2025-01-02T00:00:00Z',
  role: 'owner'
}
const JANE: Member = {
  id: 'u-jane',
  name: 'Jane',
  email: 'jane@test.comfy.org',
  joined_at: '2025-01-03T00:00:00Z',
  role: 'member'
}
const JOHN: Member = {
  id: 'u-john',
  name: 'John',
  email: 'john@test.comfy.org',
  joined_at: '2025-01-04T00:00:00Z',
  role: 'member'
}

interface RoleChangeRequest {
  url: string
  role: string
}

interface MemberMockState {
  members: Member[]
  patches: RoleChangeRequest[]
}

async function mockCloudBoot(page: Page): Promise<MemberMockState> {
  const state: MemberMockState = {
    members: [CREATOR, VIEWER, JANE, JOHN].map((m) => ({ ...m })),
    patches: []
  }

  // `/api/features` is the remote-config source: production builds resolve
  // the workspaces flag from it (the `ff:` localStorage override is dev-only).
  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({ team_workspaces_enabled: true } satisfies RemoteConfig)
    )
  )
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  await page.route('**/api/settings', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/api/auth/token', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))

  const teamWorkspace: WorkspaceWithRole = {
    id: 'ws-team',
    name: 'Team Comfy',
    type: 'team',
    created_at: '2025-01-01T00:00:00Z',
    joined_at: '2025-01-02T00:00:00Z',
    role: 'owner',
    subscription_tier: 'PRO'
  }
  await page.route('**/api/workspaces', (r) =>
    r.fulfill(jsonRoute({ workspaces: [teamWorkspace] }))
  )

  await page.route('**/api/workspace/members**', (route: Route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const url = request.url()
      const id = url.match(/\/api\/workspace\/members\/([^/?]+)/)?.[1]
      const { role } = request.postDataJSON() as { role: Member['role'] }
      state.patches.push({ url, role })
      const member = state.members.find((m) => m.id === id)
      if (member) member.role = role
      return route.fulfill(jsonRoute({}))
    }
    return route.fulfill(
      jsonRoute({
        members: state.members,
        pagination: { offset: 0, limit: 50, total: state.members.length }
      })
    )
  })
  await page.route('**/api/workspace/invites', (r) =>
    r.fulfill(jsonRoute({ invites: [] }))
  )

  const billingStatus: BillingStatusResponse = {
    is_active: true,
    subscription_status: 'active',
    subscription_tier: 'PRO',
    subscription_duration: 'MONTHLY',
    plan_slug: 'pro-monthly',
    billing_status: 'paid',
    has_funds: true,
    renewal_date: '2099-02-20T00:00:00Z'
  }
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(billingStatus))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(
      jsonRoute({
        amount_micros: 6000,
        currency: 'usd',
        effective_balance_micros: 6000,
        cloud_credit_balance_micros: 5000,
        prepaid_balance_micros: 1000
      })
    )
  )
  // `max_seats > 1` on the current plan is what flips `isOnTeamPlan`,
  // which gates the whole role-management UI.
  const proPlan: Plan = {
    slug: 'pro-monthly',
    tier: 'PRO',
    duration: 'MONTHLY',
    price_cents: 10000,
    credits_cents: 21100,
    max_seats: 30,
    availability: { available: true },
    seat_summary: {
      seat_count: 4,
      total_cost_cents: 40000,
      total_credits_cents: 0
    }
  }
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ current_plan_slug: 'pro-monthly', plans: [proPlan] }))
  )

  return state
}

async function openMembersTab(page: Page) {
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
  await expect(content.getByText('4 of 30 members')).toBeVisible()
  return content
}

function memberRow(content: ReturnType<Page['locator']>, email: string) {
  return content
    .locator('div.grid')
    .filter({ has: content.page().getByText(email, { exact: true }) })
}

// Reka submenus open on real pointer travel or keyboard; Playwright's
// synthetic hover doesn't trigger the pointermove handler, so drive the
// subtrigger with ArrowRight instead.
async function openChangeRoleSubmenu(page: Page) {
  const trigger = page.getByRole('menuitem', { name: 'Change role' })
  await expect(trigger).toBeVisible()
  await trigger.press('ArrowRight')
  await expect(
    page.getByRole('menuitem', { name: 'Owner', exact: true })
  ).toBeVisible()
}

async function setupCloudPage(page: Page): Promise<MemberMockState> {
  const state = await mockCloudBoot(page)
  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
    localStorage.setItem('Comfy.Workspace.LastWorkspaceId', 'ws-team')
  })
  return state
}

test.describe('Member role change (Members tab)', { tag: '@cloud' }, () => {
  test('row menus respect creator and self guards', async ({ page }) => {
    test.setTimeout(60_000)
    await setupCloudPage(page)
    const content = await openMembersTab(page)

    // US8/US9 — no row actions on the creator row (Liz) nor on the viewer's
    // own row; the two plain members each expose a menu.
    await expect(
      memberRow(content, 'john@test.comfy.org').getByRole('button', {
        name: 'More Options'
      })
    ).toBeVisible()
    await expect(
      memberRow(content, 'jane@test.comfy.org').getByRole('button', {
        name: 'More Options'
      })
    ).toBeVisible()
    await expect(
      memberRow(content, 'liz@test.comfy.org').getByRole('button', {
        name: 'More Options'
      })
    ).toHaveCount(0)
    await expect(
      memberRow(content, 'e2e@test.comfy.org').getByRole('button', {
        name: 'More Options'
      })
    ).toHaveCount(0)

    // US1/US12 — the row menu exposes Change role and the FE-768 remove flow.
    await memberRow(content, 'jane@test.comfy.org')
      .getByRole('button', { name: 'More Options' })
      .click()
    await expect(
      page.getByRole('menuitem', { name: 'Change role' })
    ).toBeVisible()
    await page.getByRole('menuitem', { name: 'Remove member' }).click()
    await expect(page.getByText('Remove this member?')).toBeVisible()
  })

  test('promote and demote round trip updates the Role column', async ({
    page
  }) => {
    test.setTimeout(90_000)
    const state = await setupCloudPage(page)
    const content = await openMembersTab(page)

    const emails = content.getByText(/@test\.comfy\.org/)
    await expect(emails).toHaveText([
      'liz@test.comfy.org',
      'e2e@test.comfy.org',
      'john@test.comfy.org',
      'jane@test.comfy.org'
    ])

    const janeRow = memberRow(content, 'jane@test.comfy.org')
    await janeRow.getByRole('button', { name: 'More Options' }).click()
    await openChangeRoleSubmenu(page)

    // US3 — picking the current role is a no-op.
    await page.getByRole('menuitem', { name: 'Member', exact: true }).click()
    await expect(page.getByRole('heading', { name: /an owner\?/ })).toHaveCount(
      0
    )
    expect(state.patches).toHaveLength(0)

    // US4 — promote dialog copy straight from Figma.
    await janeRow.getByRole('button', { name: 'More Options' }).click()
    await openChangeRoleSubmenu(page)
    await page.getByRole('menuitem', { name: 'Owner', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Make Jane an owner?' })
    ).toBeVisible()
    await expect(
      page.getByText(
        "They'll have the same access as you — managing members, billing, and workspace settings."
      )
    ).toBeVisible()

    // US5 — cancel leaves the role untouched.
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Make Jane an owner?' })
    ).toHaveCount(0)
    await expect(janeRow.getByText('Member', { exact: true })).toBeVisible()
    expect(state.patches).toHaveLength(0)

    // US6 — confirming PATCHes the proposed contract and re-sorts the row
    // under the creator; the promoted owner keeps its row menu.
    await janeRow.getByRole('button', { name: 'More Options' }).click()
    await openChangeRoleSubmenu(page)
    await page.getByRole('menuitem', { name: 'Owner', exact: true }).click()
    await page.getByRole('button', { name: 'Make owner' }).click()

    await expect(page.getByText('Role updated')).toBeVisible()
    await expect(janeRow.getByText('Owner', { exact: true })).toBeVisible()
    await expect(emails).toHaveText([
      'liz@test.comfy.org',
      'e2e@test.comfy.org',
      'jane@test.comfy.org',
      'john@test.comfy.org'
    ])
    expect(state.patches).toEqual([
      {
        url: expect.stringContaining('/api/workspace/members/u-jane'),
        role: 'owner'
      }
    ])

    // US7 — demote round trip from the promoted owner row.
    await janeRow.getByRole('button', { name: 'More Options' }).click()
    await openChangeRoleSubmenu(page)
    await page.getByRole('menuitem', { name: 'Member', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Demote Jane to member?' })
    ).toBeVisible()
    await expect(page.getByText("They'll lose admin access.")).toBeVisible()
    await page.getByRole('button', { name: 'Demote to member' }).click()

    await expect(janeRow.getByText('Member', { exact: true })).toBeVisible()
    expect(state.patches).toHaveLength(2)
    expect(state.patches[1].role).toBe('member')
  })

  test('failed role change keeps the dialog open with an error toast', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await setupCloudPage(page)
    // Override the member route so PATCH fails after boot succeeds.
    await page.route('**/api/workspace/members/**', (route: Route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, body: '{}' })
        : route.fallback()
    )
    const content = await openMembersTab(page)

    const janeRow = memberRow(content, 'jane@test.comfy.org')
    await janeRow.getByRole('button', { name: 'More Options' }).click()
    await openChangeRoleSubmenu(page)
    await page.getByRole('menuitem', { name: 'Owner', exact: true }).click()
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
