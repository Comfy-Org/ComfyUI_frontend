import type { Page, Route } from '@playwright/test'

import type { Member } from '@/platform/workspace/api/workspaceApi'

import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import {
  DEFAULT_TEAM_MEMBERS,
  TEAM_BILLING_STATUS,
  TEAM_PRO_PLAN,
  TEAM_WORKSPACE,
  WORKSPACE_FEATURE_FLAG
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { mockWorkspaceTokenMint } from '@e2e/fixtures/utils/workspaceMocks'

interface RoleChangeRequest {
  url: string
  role: string
}

interface MemberMockState {
  members: Member[]
  patches: RoleChangeRequest[]
}

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

/**
 * Boots the cloud app against fully mocked workspace + billing endpoints so
 * member/role specs can drive a raw `page` (the `comfyPage` fixture would try
 * to reach the OSS devtools backend during setup).
 *
 * Returns the mutable mock state: `members` reflects PATCH-applied roles and
 * `patches` records every role-change request for assertion.
 */
export class CloudWorkspaceMockHelper {
  constructor(private readonly page: Page) {}

  async setup(
    members: Member[] = DEFAULT_TEAM_MEMBERS
  ): Promise<MemberMockState> {
    const state = await this.mockBoot(members)
    await new CloudAuthHelper(this.page).mockAuth()
    await this.page.addInitScript(() => {
      localStorage.setItem('Comfy.userId', 'test-user-e2e')
      localStorage.setItem('Comfy.Workspace.LastWorkspaceId', 'ws-team')
    })
    return state
  }

  private async mockBoot(members: Member[]): Promise<MemberMockState> {
    const state: MemberMockState = {
      members: members.map((m) => ({ ...m })),
      patches: []
    }
    const { page } = this

    await page.route('**/api/features', (r) =>
      r.fulfill(jsonRoute(WORKSPACE_FEATURE_FLAG))
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
    // A non-empty settings payload with TutorialCompleted marks the user as
    // returning, so the new-user Templates dialog never auto-opens to block the
    // Settings button. Errors tab off suppresses the model-folder 401 toast.
    await page.route('**/api/settings', (r) =>
      r.fulfill(
        jsonRoute({
          'Comfy.TutorialCompleted': true,
          'Comfy.RightSidePanel.ShowErrorsTab': false
        })
      )
    )
    await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
    await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
    await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
    await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
    await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
    await page.route('**/api/auth/session', (r) =>
      r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
    )
    await mockWorkspaceTokenMint(page, TEAM_WORKSPACE)
    await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))

    await page.route('**/api/workspaces', (r) =>
      r.fulfill(jsonRoute({ workspaces: [TEAM_WORKSPACE] }))
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
        // Echo the updated row like the real BE; the store merges only the role
        // locally, so the response body shape is not load-bearing.
        return route.fulfill(jsonRoute(member))
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

    await page.route('**/api/billing/status', (r) =>
      r.fulfill(jsonRoute(TEAM_BILLING_STATUS))
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
    await page.route('**/api/billing/plans', (r) =>
      r.fulfill(
        jsonRoute({
          current_plan_slug: TEAM_PRO_PLAN.slug,
          plans: [TEAM_PRO_PLAN]
        })
      )
    )

    return state
  }
}
