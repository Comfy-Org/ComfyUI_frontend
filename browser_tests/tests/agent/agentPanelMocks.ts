import type { Page, Route } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  AgentDraftSnapshot,
  AgentTurnAccepted,
  AgentWsEvent,
  DraftPatchData
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = 'd4c016c4-3b8c-44cf-97de-1ae27e43e718'
const TURN_ID = '3818ba00-d772-4a3f-98c1-9312725b577d'
const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

const TURN_ACCEPTED: AgentTurnAccepted = {
  message_id: TURN_ID,
  thread_id: THREAD_ID,
  workflow_id: WORKFLOW_ID
}

const DRAFT_GRAPH: ComfyWorkflowJSON = {
  version: 0.4,
  last_node_id: 2,
  last_link_id: 0,
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      pos: [100, 300],
      size: [210, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [] },
        { name: 'CLIP', type: 'CLIP', links: [] },
        { name: 'VAE', type: 'VAE', links: [] }
      ],
      properties: {},
      widgets_values: ['sd_xl_base_1.0.safetensors']
    },
    {
      id: 2,
      type: 'SaveImage',
      pos: [1400, 300],
      size: [210, 100],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: 'images', type: 'IMAGE', link: null }],
      outputs: [],
      properties: {},
      widgets_values: ['ComfyUI']
    }
  ],
  links: []
}

const DRAFT_SNAPSHOT: AgentDraftSnapshot = {
  content: DRAFT_GRAPH as unknown as Record<string, unknown>,
  version: 24
}

export const DRAFT_PATCH: DraftPatchData = {
  base_version: 24,
  version: 25,
  content: DRAFT_GRAPH as unknown as Record<string, unknown>,
  workflow_id: WORKFLOW_ID,
  message_id: TURN_ID,
  thread_id: THREAD_ID
}

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
    tool_name: 'set_widget',
    status: 'ok',
    args: ['workflow', 'set-widget', 'workflow.json'],
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
    team_workspaces_enabled: true,
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

  await page.route('**/api/features', (r) =>
    r.fulfill(jsonRoute(agentFeatures(agentFlag)))
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
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
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
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(TURN_ACCEPTED)
      })
    }
    return route.fulfill(jsonRoute([]))
  })

  await page.route('**/api/agent/draft**', (r) =>
    r.fulfill(jsonRoute(DRAFT_SNAPSHOT))
  )
}

type AgentFixtures = {
  agentFlagEnabled: boolean
  postedMessages: string[]
}

export const agentTest = comfyPageFixture.extend<AgentFixtures>({
  agentFlagEnabled: [true, { option: true }],
  postedMessages: async ({}, use) => {
    await use([])
  },
  page: async ({ page, agentFlagEnabled, postedMessages }, use) => {
    await mockAgentBoot(page, { agentFlag: agentFlagEnabled, postedMessages })
    await use(page)
  }
})
