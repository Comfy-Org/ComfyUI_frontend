import type {
  AgentIdentity,
  AgentRunMode,
  ExchangeTokenRequest,
  ListMembersResponse
} from '@comfyorg/ingest-types'
import { mergeTests } from '@playwright/test'

import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import {
  EMPTY_BILLING_BALANCE,
  EMPTY_BILLING_PLANS,
  ENDED_STANDARD_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import {
  WORKSPACE_SWITCHER_REMOTE_CONFIG,
  WORKSPACE_SWITCHER_WORKSPACES
} from '@e2e/fixtures/data/workspaceSwitcher'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

interface AgentIdentityRead {
  workspaceId: string
}

const base = mergeTests(agentTest, webSocketFixture)

export const agentWorkspaceSwitcherTest = base.extend<{
  agentIdentityReads: AgentIdentityRead[]
  agentPanel: AgentPanel
}>({
  agentIdentityReads: async ({ page, agentFlagEnabled }, use) => {
    const reads: AgentIdentityRead[] = []
    let workspaceId = 'ws-personal'
    const runMode: AgentRunMode = {
      mode: 'ask_approval',
      credit_limit: null
    }

    await page.addInitScript(
      (workspaceIds) => {
        for (const workspaceId of workspaceIds) {
          localStorage.setItem(
            `Comfy.AgentPanel.onboarded.test-user-e2e.${workspaceId}`,
            'true'
          )
        }
      },
      ['ws-personal', 'ws-team']
    )

    await bootAgentApp(page, agentFlagEnabled, {
      features: WORKSPACE_SWITCHER_REMOTE_CONFIG,
      settings: { 'Comfy.UseNewMenu': 'Top' },
      beforeNavigate: async (page) => {
        await mockWorkspaceList(page, WORKSPACE_SWITCHER_WORKSPACES)
        await page.route('**/api/workspace/members**', (route) =>
          route.fulfill(
            jsonRoute({
              members: [],
              pagination: { offset: 0, limit: 50, total: 0, has_more: false }
            } satisfies ListMembersResponse)
          )
        )
        await page.route('**/api/auth/token', async (route) => {
          const request = route.request().postDataJSON() as ExchangeTokenRequest
          workspaceId = request.workspace_id ?? 'ws-personal'
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
            user_id: 'uid-1',
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
        await page.route('**/api/billing/capabilities', (route) =>
          route.fulfill(jsonRoute(createBillingCapabilities(workspaceId)))
        )
        await page.route('**/api/experiment/models', (route) =>
          route.fulfill(jsonRoute([]))
        )
        await page.route('**/api/agent/threads?*', (route) =>
          route.fulfill(jsonRoute(emptyAgentThreadList()))
        )
        await page.route('**/api/agent/run-mode', (route) =>
          route.fulfill(jsonRoute(runMode))
        )
        await page.route('**/api/agent/identity', (route) => {
          const token = route
            .request()
            .headers()
            ['authorization']?.replace(/^Bearer /, '')
          const identityWorkspace = WORKSPACE_SWITCHER_WORKSPACES.find(
            ({ id }) => token === `mock-workspace-token-${id}`
          )
          if (!identityWorkspace) {
            return route.fulfill({ status: 401 })
          }
          reads.push({ workspaceId: identityWorkspace.id })
          const identity: AgentIdentity = {
            workspace_id: identityWorkspace.id,
            user_id: 'uid-1'
          }
          return route.fulfill(jsonRoute(identity))
        })
      }
    })

    await use(reads)
  },
  agentPanel: async ({ page }, use) => {
    await use(new AgentPanel(page))
  }
})
