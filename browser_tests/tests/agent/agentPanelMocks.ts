import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/schemas/apiSchema'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  AgentCancelAccepted,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockCloudBootRoutes } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = 'd4c016c4-3b8c-44cf-97de-1ae27e43e718'
const TURN_ID = '3818ba00-d772-4a3f-98c1-9312725b577d'
const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

const TURN_ACCEPTED: AgentTurnAccepted = {
  message_id: TURN_ID,
  thread_id: THREAD_ID,
  workflow_id: WORKFLOW_ID
}

const CANCEL_ACCEPTED: AgentCancelAccepted = { status: 'cancelling' }

export const THINKING_TEXT =
  "I'll set the positive prompt to your red fox scene."

export const THINKING_EVENT: AgentWsEvent = {
  type: 'agent_thinking',
  data: {
    delta: THINKING_TEXT,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const TOOL_CALL_EVENT: AgentWsEvent = {
  type: 'agent_tool_call',
  data: {
    tool_call_id: 'call-set-widget',
    tool_name: 'set_widget',
    status: 'success',
    duration_ms: 1300,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const INTERMEDIATE_MESSAGE_EVENT: AgentWsEvent = {
  type: 'agent_message_delta',
  data: {
    delta: 'The first graph edit is complete. I will check the remaining work.',
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const RESUMED_THINKING_EVENT: AgentWsEvent = {
  type: 'agent_thinking',
  data: {
    delta: 'Checking the remaining edits.',
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const OPEN_TAB_TOOL_EVENT: AgentWsEvent = {
  type: 'agent_tool_call',
  data: {
    tool_call_id: 'call-new-tab',
    tool_name: 'new_tab',
    status: 'success',
    duration_ms: 500,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const RESIZE_IMAGE_TOOL_EVENT: AgentWsEvent = {
  type: 'agent_tool_call',
  data: {
    tool_call_id: 'call-resize-image-node',
    tool_name: 'resize_image_node',
    status: 'success',
    duration_ms: 200,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

const MESSAGE_DELTA_TEXT =
  'The graph is **fully ready** to go — prompt set to the red fox in the snow.'

export const MESSAGE_DELTA_EVENT: AgentWsEvent = {
  type: 'agent_message_delta',
  data: {
    delta: MESSAGE_DELTA_TEXT,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const MESSAGE_DONE_EVENT: AgentWsEvent = {
  type: 'agent_message_done',
  data: {
    message_id: TURN_ID,
    thread_id: THREAD_ID,
    usage: {
      input_tokens: 4493,
      output_tokens: 425,
      total_tokens: 12393,
      cache_read_input_tokens: 35596,
      cache_creation_input_tokens: 0
    }
  }
}

function agentFeatures(agentFlag: boolean): RemoteConfig {
  return {
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_config: {
      advanced_disable_flags: true,
      bootstrap: {
        featureFlags: { 'agent-in-app-experience': agentFlag }
      }
    }
  }
}

async function mockAgentBoot(
  page: Page,
  {
    agentFlag,
    postedMessages
  }: { agentFlag: boolean; postedMessages: string[] }
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
  })

  await mockBilling(page)
  await page.route('**/api/assets**', (r) =>
    r.fulfill(jsonRoute({ assets: [] }))
  )

  await mockCloudBootRoutes(page, {
    features: agentFeatures(agentFlag),
    settings: {
      'Comfy.TutorialCompleted': true,
      'Comfy.RightSidePanel.ShowErrorsTab': false
    }
  })
  let savedWorkflow: UserDataFullInfo | undefined
  let savedContent: string | undefined
  await page.route('**/api/userdata**', (route) => {
    const url = new URL(route.request().url())
    const path = decodeURIComponent(url.pathname.split('/userdata/')[1] ?? '')
    if (route.request().method() === 'POST' && path.startsWith('workflows/')) {
      savedContent = route.request().postData() ?? '{}'
      savedWorkflow = {
        path,
        modified: 1_788_825_600_000,
        size: route.request().postDataBuffer()?.length ?? 0
      }
      return route.fulfill(jsonRoute(savedWorkflow))
    }
    if (savedWorkflow && path === savedWorkflow.path)
      return route.fulfill({
        contentType: 'application/json',
        body: savedContent
      })
    return route.fulfill(
      jsonRoute(
        savedWorkflow && url.searchParams.get('dir') === 'workflows'
          ? [
              {
                ...savedWorkflow,
                path: savedWorkflow.path.slice('workflows/'.length)
              }
            ]
          : []
      )
    )
  })
  await page.route('**/api/workflows?*', (route) => {
    const workflows: WorkflowListResponse = {
      data: savedWorkflow
        ? [
            {
              id: WORKFLOW_ID,
              name: savedWorkflow.path.slice(
                'workflows/'.length,
                -'.json'.length
              ),
              created_at: '2026-09-01T00:00:00Z',
              updated_at: '2026-09-01T00:00:00Z',
              created_by: 'test-user-e2e',
              latest_version: 1
            }
          ]
        : [],
      pagination: {
        offset: 0,
        limit: 100,
        total: savedWorkflow ? 1 : 0,
        has_more: false
      }
    }
    return route.fulfill(jsonRoute(workflows))
  })
  const threads: AgentThreadListResponse = {
    threads: [],
    pagination: { offset: 0, limit: 100, total: 0, has_more: false }
  }
  await page.route('**/api/agent/threads', (route) =>
    route.fulfill(jsonRoute(threads))
  )

  await page.route('**/api/auth/token', (r) =>
    r.fulfill(
      jsonRoute({
        token: 'mock-workspace-token',
        expires_at: '2100-01-01T00:00:00.000Z',
        workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
        role: 'owner',
        permissions: ['owner:*']
      })
    )
  )
  await page.route('**/api/workspaces', (r) =>
    r.fulfill(
      jsonRoute({
        workspaces: [
          {
            id: 'ws-personal',
            name: 'Personal',
            type: 'personal',
            role: 'owner'
          }
        ]
      })
    )
  )

  await page.route('**/api/agent/threads/*/messages', (route: Route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      postedMessages.push(request.postData() ?? '')
      const accepted: AgentTurnAccepted = {
        ...TURN_ACCEPTED,
        message_id:
          postedMessages.length === 1
            ? TURN_ID
            : `${TURN_ID}-${postedMessages.length}`
      }
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(accepted)
      })
    }
    return route.fulfill(jsonRoute([]))
  })

  await page.route('**/api/agent/threads/*/messages/*/cancel', (route: Route) =>
    route.fulfill(jsonRoute(CANCEL_ACCEPTED))
  )
}

type AgentFixtures = {
  agentFlagEnabled: boolean
  postedMessages: string[]
}

export const agentTest = comfyPageFixture.extend<AgentFixtures>({
  agentFlagEnabled: [true, { option: true }],
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires an object pattern.
  postedMessages: async ({}, use) => {
    await use([])
  },
  page: async ({ page, agentFlagEnabled, postedMessages }, use) => {
    await mockAgentBoot(page, { agentFlag: agentFlagEnabled, postedMessages })
    await use(page)
  }
})

export async function selectAgentWorkflow(page: Page): Promise<void> {
  const picker = page.locator('#agent-panel-root').getByRole('button', {
    name: enMessages.agent.switchWorkflow
  })
  await picker.click()
  await page
    .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
    .click()
  await expect(picker).toHaveText('Unsaved Workflow')
}
