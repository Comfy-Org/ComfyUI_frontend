import type { Locator, Page, Route } from '@playwright/test'
import type {
  BillingCapabilities,
  BillingStatusResponse
} from '@comfyorg/ingest-types'

import type {
  Member,
  Plan,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import {
  CLOUD_REMOTE_CONFIG,
  DEFAULT_TEAM_MEMBERS,
  TEAM_BILLING_STATUS,
  TEAM_PRO_PLAN,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { mockCloudBootRoutes } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspaceTokenMint } from '@e2e/fixtures/utils/workspaceMocks'

interface RoleChangeRequest {
  url: string
  role: string
}

interface MemberMockState {
  members: Member[]
  patches: RoleChangeRequest[]
}

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

  async openPlanAndCreditsSettings(): Promise<Locator> {
    await this.page.goto(
      process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
    )
    await this.page.waitForFunction(
      () => !!window.app?.extensionManager,
      null,
      {
        timeout: 45_000
      }
    )
    await this.page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()
    const dialog = this.page.getByTestId(TestIds.dialogs.settings)
    await dialog.waitFor({ state: 'visible' })
    await dialog
      .locator('nav')
      .getByRole('button', { name: 'Plan & Credits', exact: true })
      .click()
    return dialog.getByRole('main')
  }

  async setup(
    members: Member[] = DEFAULT_TEAM_MEMBERS,
    activeWorkspace: WorkspaceWithRole = TEAM_WORKSPACE,
    billingStatus: BillingStatusResponse = TEAM_BILLING_STATUS,
    capabilityOverrides: Partial<BillingCapabilities> = {}
  ): Promise<MemberMockState> {
    const state = await this.mockBoot(
      members,
      activeWorkspace,
      billingStatus,
      capabilityOverrides
    )
    await new CloudAuthHelper(this.page).mockAuth()
    await this.page.addInitScript((workspaceId) => {
      localStorage.setItem('Comfy.userId', 'test-user-e2e')
      localStorage.setItem('Comfy.Workspace.LastWorkspaceId', workspaceId)
    }, activeWorkspace.id)
    return state
  }

  private async mockBoot(
    members: Member[],
    activeWorkspace: WorkspaceWithRole,
    billingStatus: BillingStatusResponse,
    capabilityOverrides: Partial<BillingCapabilities> = {}
  ): Promise<MemberMockState> {
    const state: MemberMockState = {
      members: members.map((m) => ({ ...m })),
      patches: []
    }
    const { page } = this

    await mockCloudBootRoutes(page, {
      features: CLOUD_REMOTE_CONFIG,
      // A non-empty settings payload with TutorialCompleted marks the user as
      // returning, so the new-user Templates dialog never auto-opens to block
      // the Settings button. Errors tab off suppresses the model-folder 401
      // toast.
      settings: {
        'Comfy.TutorialCompleted': true,
        'Comfy.RightSidePanel.ShowErrorsTab': false
      }
    })
    await mockWorkspaceTokenMint(page, activeWorkspace)

    await page.route('**/api/workspaces', (r) =>
      r.fulfill(jsonRoute({ workspaces: [activeWorkspace] }))
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
      r.fulfill(jsonRoute(billingStatus))
    )
    await page.route('**/api/billing/capabilities', (r) => {
      if (r.request().method() !== 'GET') return r.fallback()
      return r.fulfill(
        jsonRoute(
          createWorkspaceBillingCapabilities(
            activeWorkspace,
            capabilityOverrides
          )
        )
      )
    })
    await page.route('**/api/billing/payment-portal', (r) =>
      r.fulfill(jsonRoute({ url: 'https://billing.example/portal' }))
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
    const currentPlan: Plan =
      billingStatus.plan_slug && billingStatus.plan_slug !== TEAM_PRO_PLAN.slug
        ? {
            ...TEAM_PRO_PLAN,
            slug: billingStatus.plan_slug,
            tier:
              billingStatus.subscription_tier === 'TEAM'
                ? TEAM_PRO_PLAN.tier
                : (billingStatus.subscription_tier ?? TEAM_PRO_PLAN.tier),
            duration:
              billingStatus.subscription_duration ?? TEAM_PRO_PLAN.duration
          }
        : TEAM_PRO_PLAN
    await page.route('**/api/billing/plans', (r) =>
      r.fulfill(
        jsonRoute({
          current_plan_slug: currentPlan.slug,
          plans: [currentPlan]
        })
      )
    )

    return state
  }
}
