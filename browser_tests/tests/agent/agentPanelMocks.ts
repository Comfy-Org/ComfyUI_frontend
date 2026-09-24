import { zGlobalSettingValue } from '@comfyorg/ingest-types/zod'
import type { Page, Route } from '@playwright/test'

import type {
  AgentThreadListResponse,
  GlobalSetting,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import type {
  AgentAnswerAccepted,
  AgentCancelAccepted,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { mockAgentIdentity } from '@e2e/fixtures/agentSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockCloudBootRoutes } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'

const THREAD_ID = 'd4c016c4-3b8c-44cf-97de-1ae27e43e718'
const TURN_ID = '3818ba00-d772-4a3f-98c1-9312725b577d'
const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

const TURN_ACCEPTED: AgentTurnAccepted = {
  message_id: TURN_ID,
  thread_id: THREAD_ID,
  workflow_id: WORKFLOW_ID
}

const CANCEL_ACCEPTED: AgentCancelAccepted = { status: 'cancelling' }
const ANSWER_ACCEPTED: AgentAnswerAccepted = { status: 'answered' }

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

type AgentAskData = Extract<AgentWsEvent, { type: 'agent_ask' }>['data']

/** An `agent_ask` frame for the first turn, with the ask fields to vary. */
export function agentAskEvent(
  ask: Pick<
    AgentAskData,
    | 'ask_id'
    | 'kind'
    | 'context'
    | 'prompt'
    | 'options'
    | 'min_selections'
    | 'max_selections'
    | 'allow_other'
  >
): AgentWsEvent {
  return {
    type: 'agent_ask',
    data: { ...ask, thread_id: THREAD_ID, message_id: TURN_ID }
  }
}

/** The server's canonical resolution of `askId`, which removes its card. */
export function agentAskResolvedEvent(
  askId: string,
  selected: string[]
): AgentWsEvent {
  return {
    type: 'agent_ask_resolved',
    data: {
      thread_id: THREAD_ID,
      message_id: TURN_ID,
      ask_id: askId,
      status: 'answered',
      selected
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
    agentConsentAccepted,
    agentConsentSave,
    agentConsentWrites,
    agentFlagEnabled,
    agentPanelInitiallyOpen,
    agentOnboardingCompleted,
    askAnswers,
    crdtDebugEnabled,
    objectInfo,
    postedMessages
  }: Omit<AgentFixtures, 'agentPanel'>
): Promise<void> {
  let consentAccepted = agentConsentAccepted

  await page.addInitScript(
    ({ initiallyOpen, onboardingCompleted, debugEnabled }) => {
      if (localStorage.getItem('Comfy.AgentPanel.open') === null) {
        localStorage.setItem('Comfy.AgentPanel.open', String(initiallyOpen))
      }
      if (localStorage.getItem('Comfy.AgentPanel.onboarded') === null) {
        localStorage.setItem(
          'Comfy.AgentPanel.onboarded',
          String(onboardingCompleted)
        )
      }
      if (debugEnabled) {
        localStorage.setItem('Comfy.Agent.CrdtDebug.enabled', 'true')
        localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
      }
    },
    {
      initiallyOpen: agentPanelInitiallyOpen,
      onboardingCompleted: agentOnboardingCompleted,
      debugEnabled: crdtDebugEnabled
    }
  )

  await mockBilling(page)
  // The canvas follower stays inactive until the agent names its user.
  await mockAgentIdentity(page)
  await page.route(
    'https://media.comfy.org/website/comfy-agent/**',
    (route) => {
      const url = route.request().url()
      if (url.endsWith('.mp4')) {
        return route.fulfill({ path: assetPath('plain_video.mp4') })
      }
      if (url.endsWith('.webm')) {
        return route.fulfill({
          path: assetPath('video/video-preview-wide.webm')
        })
      }
      return route.fulfill({ path: assetPath('image64x64.webp') })
    }
  )
  await page.route('**/api/assets**', (r) =>
    r.fulfill(jsonRoute({ assets: [] }))
  )

  await mockCloudBootRoutes(page, {
    features: agentFeatures(agentFlagEnabled),
    settings: {
      'Comfy.TutorialCompleted': true,
      'Comfy.RightSidePanel.ShowErrorsTab': false
    },
    objectInfo
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
  const storedConsent: GlobalSetting = {
    key: AGENT_CONSENT_SETTING_ID,
    value: true,
    updated_at: '2026-09-09T00:00:00Z'
  }
  await page.route(
    `**/api/global-settings/${AGENT_CONSENT_SETTING_ID}`,
    (route) =>
      route.fulfill(
        consentAccepted
          ? jsonRoute(storedConsent)
          : {
              ...jsonRoute({
                code: 'NOT_FOUND',
                message: 'Setting is not set for this user and workspace'
              }),
              status: 404
            }
      )
  )
  await page.route('**/api/global-settings', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fulfill({ status: 405 })
    const setting = zGlobalSettingValue.parse(request.postDataJSON())
    const { status, pending } = agentConsentSave
    agentConsentWrites.push(setting.value)
    await pending
    if (status >= 400) return route.fulfill({ status })
    consentAccepted = setting.value
    return route.fulfill({
      ...jsonRoute(storedConsent),
      status
    })
  })
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

  await page.route('**/api/agent/threads/*/asks/*/answer', (route: Route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fulfill({ status: 405 })
    askAnswers.push({
      path: new URL(request.url()).pathname,
      body: request.postDataJSON()
    })
    return route.fulfill(jsonRoute(ANSWER_ACCEPTED))
  })
}

type AgentFixtures = {
  agentConsentAccepted: boolean
  agentConsentSave: { status: number; pending?: Promise<void> }
  agentConsentWrites: boolean[]
  agentFlagEnabled: boolean
  agentPanel: AgentPanel
  agentPanelInitiallyOpen: boolean
  agentOnboardingCompleted: boolean
  /** Every ask answer the panel POSTed, in order. */
  askAnswers: { path: string; body: unknown }[]
  crdtDebugEnabled: boolean
  /** `'server'` loads real node definitions instead of the empty catalog. */
  objectInfo: 'server' | undefined
  postedMessages: string[]
}

export const agentTest = comfyPageFixture.extend<AgentFixtures>({
  agentConsentAccepted: [true, { option: true }],
  agentConsentSave: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use({ status: 200 })
  },
  agentConsentWrites: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  },
  agentFlagEnabled: [true, { option: true }],
  agentPanel: async ({ comfyPage }, use) => {
    await use(new AgentPanel(comfyPage.page))
  },
  agentPanelInitiallyOpen: [false, { option: true }],
  agentOnboardingCompleted: [true, { option: true }],
  askAnswers: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  },
  crdtDebugEnabled: [false, { option: true }],
  objectInfo: [undefined, { option: true }],
  page: async (
    {
      agentConsentAccepted,
      agentConsentSave,
      agentConsentWrites,
      agentFlagEnabled,
      agentPanelInitiallyOpen,
      agentOnboardingCompleted,
      askAnswers,
      crdtDebugEnabled,
      objectInfo,
      page,
      postedMessages
    },
    use
  ) => {
    await mockAgentBoot(page, {
      agentConsentAccepted,
      agentConsentSave,
      agentConsentWrites,
      agentFlagEnabled,
      agentPanelInitiallyOpen,
      agentOnboardingCompleted,
      askAnswers,
      crdtDebugEnabled,
      objectInfo,
      postedMessages
    })
    await use(page)
  },
  postedMessages: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  }
})
