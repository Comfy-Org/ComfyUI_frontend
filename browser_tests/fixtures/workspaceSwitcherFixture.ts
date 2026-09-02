import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import {
  EMPTY_BILLING_BALANCE,
  EMPTY_BILLING_PLANS,
  ENDED_STANDARD_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { makeWorkspaceTokenResponse } from '@e2e/fixtures/data/workspaceAuthFixtures'
import {
  WORKSPACE_SWITCHER_REMOTE_CONFIG,
  WORKSPACE_SWITCHER_WORKSPACES
} from '@e2e/fixtures/data/workspaceSwitcher'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Boots the app with the workspace-switcher endpoints mocked: remote config
 * (team workspaces enabled), the workspace list, workspace-token minting and
 * billing capabilities for the selected workspace, and a no-op session refresh.
 */
interface WorkspaceSwitchTokenGate {
  requestReceived: Promise<void>
  release: () => void
}

export const workspaceSwitcherTest = comfyPageFixture.extend<{
  workspaceSwitchTokenGate: WorkspaceSwitchTokenGate
}>({
  page: async ({ page }, use) => {
    await page.route('**/api/features', (route) =>
      route.fulfill(jsonRoute(WORKSPACE_SWITCHER_REMOTE_CONFIG))
    )

    await mockWorkspaceList(page, WORKSPACE_SWITCHER_WORKSPACES)

    await page.route('**/api/auth/token', async (route) => {
      const requestBody = route.request().postDataJSON() as {
        workspace_id?: string
      }
      const workspaceId = requestBody.workspace_id ?? 'ws-personal'
      const workspace = WORKSPACE_SWITCHER_WORKSPACES.find(
        ({ id }) => id === workspaceId
      )
      if (!workspace) {
        await route.fulfill({ status: 404 })
        return
      }

      const response: WorkspaceTokenResponse = {
        token: `mock-workspace-token-${workspace.id}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type
        },
        role: workspace.role,
        permissions: []
      }
      await route.fulfill(jsonRoute(response))
    })

    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 204 })
    )
    await page.route('**/api/billing/status', (route) =>
      route.fulfill(jsonRoute(ENDED_STANDARD_BILLING_STATUS))
    )
    await page.route('**/api/billing/balance', (route) =>
      route.fulfill(jsonRoute(EMPTY_BILLING_BALANCE))
    )
    await page.route('**/api/billing/plans', (route) =>
      route.fulfill(jsonRoute(EMPTY_BILLING_PLANS))
    )
    await page.route('**/api/billing/capabilities', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const token = route.request().headers().authorization
      const prefix = 'Bearer mock-workspace-token-'
      const workspaceId = token?.startsWith(prefix)
        ? token.slice(prefix.length)
        : 'ws-personal'
      await route.fulfill(
        jsonRoute(
          createBillingCapabilities(workspaceId, {
            can_top_up: workspaceId !== 'ws-team-long'
          })
        )
      )
    })

    await use(page)
  },
  workspaceSwitchTokenGate: async ({ page }, use) => {
    let markRequestReceived: () => void = () => {}
    const requestReceived = new Promise<void>((resolve) => {
      markRequestReceived = resolve
    })
    let releaseToken: () => void = () => {}
    const tokenRelease = new Promise<void>((resolve) => {
      releaseToken = resolve
    })
    await page.route('**/api/auth/token', async (route) => {
      const requestBody = route.request().postDataJSON() as {
        workspace_id?: string
      }
      if (requestBody.workspace_id !== 'ws-team') {
        await route.fallback()
        return
      }

      markRequestReceived()
      await tokenRelease
      const workspace = WORKSPACE_SWITCHER_WORKSPACES.find(
        ({ id }) => id === requestBody.workspace_id
      )
      if (!workspace) {
        await route.fulfill({ status: 404 })
        return
      }
      await route.fulfill(
        jsonRoute(
          makeWorkspaceTokenResponse(
            workspace,
            `mock-workspace-token-${workspace.id}`
          )
        )
      )
    })

    try {
      await use({
        requestReceived,
        release: releaseToken
      })
    } finally {
      releaseToken()
    }
  }
})
