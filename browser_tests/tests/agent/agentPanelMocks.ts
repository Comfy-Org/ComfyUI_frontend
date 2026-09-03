import type { Page, Route } from '@playwright/test'
import { mint } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  AgentCancelAccepted,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { encodeBase64 } from '@/workbench/extensions/agent/crdt/docFrameClient'

import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = 'd4c016c4-3b8c-44cf-97de-1ae27e43e718'
const TURN_ID = '3818ba00-d772-4a3f-98c1-9312725b577d'
export const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

export type AgentWireFrame =
  | ReturnType<typeof agentWorkflowUpdates>['initial']
  | ReturnType<typeof agentDocSubscribed>
  | typeof SOCKET_READY_EVENT

export const SOCKET_READY_EVENT = {
  type: 'status',
  data: { status: { exec_info: { queue_remaining: 0 } } }
} as const

export function agentDocSubscribed() {
  return {
    type: 'doc_subscribed' as const,
    data: { v: 1 as const, workflow_id: WORKFLOW_ID, ok: true, seq: 1 }
  }
}

export function agentWorkflowUpdates() {
  const doc = mint(
    {
      nodes: [
        {
          id: 41,
          type: 'AgentE2ENode',
          title: 'Agent-created node',
          pos: [160, 120],
          size: [220, 100],
          inputs: [],
          outputs: []
        }
      ],
      links: []
    },
    { types: {} }
  )
  const initialUpdate = Y.encodeStateAsUpdate(doc)
  const initialStateVector = Y.encodeStateVector(doc)
  doc.getMap('_e2e').set('reconnected', true)
  const reconnectDelta = Y.encodeStateAsUpdate(doc, initialStateVector)
  doc.destroy()
  return {
    initial: {
      type: 'doc_update' as const,
      data: {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        update_b64: encodeBase64(initialUpdate),
        actor: 'agent:e2e:tab-a',
        op_ids: ['agent-e2e-add-node']
      }
    },
    initialStateVector: encodeBase64(initialStateVector),
    reconnectDelta: {
      type: 'doc_update' as const,
      data: {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 2,
        update_b64: encodeBase64(reconnectDelta),
        actor: 'agent:e2e:tab-a',
        op_ids: ['agent-e2e-reconnect-delta']
      }
    }
  }
}

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
