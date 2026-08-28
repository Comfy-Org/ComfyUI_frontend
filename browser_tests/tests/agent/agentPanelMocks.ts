import type { Page, Route } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import type {
  AgentCancelAccepted,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

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
  agentFlag: boolean,
  postedMessages: string[],
  initialConsentAccepted: boolean,
  panelInitiallyOpen: boolean,
  consentSaveStatus: number,
  consentWrites: boolean[]
): Promise<void> {
  let consentAccepted = initialConsentAccepted

  await page.addInitScript((initiallyOpen) => {
    if (localStorage.getItem('Comfy.AgentPanel.open') === null) {
      localStorage.setItem('Comfy.AgentPanel.open', String(initiallyOpen))
    }
  }, panelInitiallyOpen)

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
        'Comfy.RightSidePanel.ShowErrorsTab': false,
        [AGENT_CONSENT_SETTING_ID]: consentAccepted
      })
    )
  )
  await page.route('**/api/settings/*', async (route) => {
    const request = route.request()
    const settingId = decodeURIComponent(new URL(request.url()).pathname)
      .split('/')
      .at(-1)
    if (request.method() !== 'POST') {
      return route.fulfill(
        jsonRoute({
          value:
            settingId === AGENT_CONSENT_SETTING_ID ? consentAccepted : undefined
        })
      )
    }

    const value: unknown = request.postDataJSON()
    if (settingId === AGENT_CONSENT_SETTING_ID && typeof value === 'boolean') {
      consentWrites.push(value)
    }
    if (settingId === AGENT_CONSENT_SETTING_ID && consentSaveStatus >= 400) {
      return route.fulfill({ status: consentSaveStatus })
    }
    if (settingId === AGENT_CONSENT_SETTING_ID && typeof value === 'boolean') {
      consentAccepted = value
    }
    return route.fulfill({
      status: settingId === AGENT_CONSENT_SETTING_ID ? consentSaveStatus : 204
    })
  })
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
  agentConsentAccepted: boolean
  agentPanelInitiallyOpen: boolean
  agentConsentSaveStatus: number
  agentConsentWrites: boolean[]
  postedMessages: string[]
}

export const agentTest = comfyPageFixture.extend<AgentFixtures>({
  agentFlagEnabled: [true, { option: true }],
  agentConsentAccepted: [true, { option: true }],
  agentPanelInitiallyOpen: [false, { option: true }],
  agentConsentSaveStatus: [204, { option: true }],
  agentConsentWrites: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  },
  postedMessages: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  },
  page: async (
    {
      page,
      agentFlagEnabled,
      postedMessages,
      agentConsentAccepted,
      agentPanelInitiallyOpen,
      agentConsentSaveStatus,
      agentConsentWrites
    },
    use
  ) => {
    await mockAgentBoot(
      page,
      agentFlagEnabled,
      postedMessages,
      agentConsentAccepted,
      agentPanelInitiallyOpen,
      agentConsentSaveStatus,
      agentConsentWrites
    )
    await use(page)
  }
})
