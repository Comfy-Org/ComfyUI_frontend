import type { Settings } from '@/platform/settings/types'
import { zGlobalSettingValue } from '@comfyorg/ingest-types/zod'
import type { Page, Route, WebSocketRoute } from '@playwright/test'

import type {
  AgentThreadListResponse,
  BillingStatusResponse,
  GlobalSetting,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import type {
  AgentCancelAccepted,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

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

export function pushAgentEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

const FUNDED_BILLING_STATUS = {
  billing_rail: 'stripe',
  billing_status: 'paid',
  has_funds: true,
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  scoped_effective_has_funds: { agent: true },
  scheduled_change: null,
  subscription_duration: 'MONTHLY',
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  team_credit_stop: null
} satisfies BillingStatusResponse

type HeldBillingRefresh = {
  entered: Promise<void>
  completed: Promise<void>
  release: () => void
}

type DeferredGate = {
  promise: Promise<void>
  release: () => void
}

function createDeferredGate(): DeferredGate {
  let release: (value?: void | PromiseLike<void>) => void = () => {
    throw new Error('Deferred gate was released before initialization')
  }
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release: () => release() }
}

class AgentBillingFixture {
  private status: BillingStatusResponse = FUNDED_BILLING_STATUS
  private available = true
  private heldRefresh:
    | {
        entered: DeferredGate
        completed: DeferredGate
        request: DeferredGate
        requestEntered: boolean
      }
    | undefined

  setAgentFunds(hasFunds: boolean): void {
    this.status = {
      ...FUNDED_BILLING_STATUS,
      has_funds: hasFunds,
      scoped_effective_has_funds: { agent: hasFunds }
    }
  }

  failSubsequentRefreshes(): void {
    this.available = false
  }

  resumeRefreshes(): void {
    this.available = true
  }

  holdNextFundedRefresh(): HeldBillingRefresh {
    const heldRefresh: NonNullable<AgentBillingFixture['heldRefresh']> = {
      entered: createDeferredGate(),
      completed: createDeferredGate(),
      request: createDeferredGate(),
      requestEntered: false
    }
    this.heldRefresh = heldRefresh

    return {
      entered: heldRefresh.entered.promise,
      completed: heldRefresh.completed.promise,
      release: () => {
        if (!heldRefresh.requestEntered) {
          throw new Error('Funded billing refresh has not entered the fixture')
        }
        heldRefresh.request.release()
      }
    }
  }

  async fulfillStatus(route: Route): Promise<void> {
    if (!this.available) {
      await route.fulfill({ status: 503 })
      return
    }
    const response = this.status
    const heldRefresh = this.heldRefresh
    let completedHeldRefresh: typeof heldRefresh
    if (heldRefresh && response.scoped_effective_has_funds?.agent) {
      this.heldRefresh = undefined
      completedHeldRefresh = heldRefresh
      heldRefresh.requestEntered = true
      heldRefresh.entered.release()
      await heldRefresh.request.promise
    }
    await route.fulfill(jsonRoute(response))
    completedHeldRefresh?.completed.release()
  }
}

export const FUNDS_UNAVAILABLE_MESSAGE =
  'Billing status is temporarily unavailable; please retry.'
const FUNDS_UNAVAILABLE = zAgentAdmissionError.parse({
  error: {
    message: FUNDS_UNAVAILABLE_MESSAGE,
    reason: 'funds_unavailable',
    type: 'SERVICE_UNAVAILABLE'
  }
})

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
    'agent-in-app-experience': agentFlag,
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_config: { advanced_disable_flags: true }
  }
}

async function mockAgentBoot(
  page: Page,
  {
    agentConsentAccepted,
    agentConsentReads,
    agentConsentSave,
    agentConsentWrites,
    agentAutoShownReadProbe,
    agentFlagEnabled,
    agentPanelInitiallyOpen,
    agentOnboardingCompleted,
    agentRetryAfter,
    agentBilling,
    acceptedTurns,
    crdtDebugEnabled,
    initialFeatureFlags,
    initialSettings,
    objectInfo,
    postedMessages,
    vueNodes
  }: Omit<AgentFixtures, 'agentPanel'> & {
    initialFeatureFlags: Record<string, unknown>
    initialSettings: Record<string, unknown>
    vueNodes: boolean
  }
): Promise<void> {
  let consentAccepted = agentConsentAccepted

  await page.addInitScript(
    ({
      initiallyOpen,
      onboardingCompleted,
      debugEnabled,
      autoShownReadProbe
    }) => {
      if (autoShownReadProbe) {
        const autoShownKey =
          'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal'
        const originalGetItem = Storage.prototype.getItem
        window.__autoShownReads = 0
        Storage.prototype.getItem = function (candidate: string) {
          if (candidate === autoShownKey)
            window.__autoShownReads = (window.__autoShownReads ?? 0) + 1
          return originalGetItem.call(this, candidate)
        }
      }
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
      debugEnabled: crdtDebugEnabled,
      autoShownReadProbe: agentAutoShownReadProbe
    }
  )

  await mockBilling(page)
  await page.route('**/api/billing/status', (route) =>
    agentBilling.fulfillStatus(route)
  )
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
    features: { ...agentFeatures(agentFlagEnabled), ...initialFeatureFlags },
    settings: {
      'Comfy.TutorialCompleted': true,
      'Comfy.RightSidePanel.ShowErrorsTab': false,
      ...({
        'Comfy.WorkflowActions.SeenItems': ['deploy-as-api']
      } satisfies Partial<Settings>),
      ...(vueNodes && { 'Comfy.VueNodes.Enabled': true }),
      ...initialSettings
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
    (route) => {
      agentConsentReads.push(consentAccepted)
      return route.fulfill(
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
    }
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
      if (agentRetryAfter !== undefined)
        return route.fulfill({
          status: 503,
          headers: {
            'content-type': 'application/json',
            'retry-after': agentRetryAfter
          },
          body: JSON.stringify(FUNDS_UNAVAILABLE)
        })
      const accepted: AgentTurnAccepted = {
        ...TURN_ACCEPTED,
        message_id:
          postedMessages.length === 1
            ? TURN_ID
            : `${TURN_ID}-${postedMessages.length}`
      }
      acceptedTurns.push(accepted)
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
  acceptedTurns: AgentTurnAccepted[]
  agentBilling: AgentBillingFixture
  agentAutoShownReadProbe: boolean
  agentConsentAccepted: boolean
  agentConsentReads: boolean[]
  agentConsentSave: { status: number; pending?: Promise<void> }
  agentConsentWrites: boolean[]
  agentFlagEnabled: boolean
  agentPanel: AgentPanel
  agentPanelInitiallyOpen: boolean
  agentOnboardingCompleted: boolean
  agentRetryAfter: string | undefined
  crdtDebugEnabled: boolean
  /** `'server'` loads real node definitions instead of the empty catalog. */
  objectInfo: 'server' | undefined
  postedMessages: string[]
}

export const agentTest = comfyPageFixture.extend<AgentFixtures>({
  acceptedTurns: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  },
  agentBilling: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use(new AgentBillingFixture())
  },
  agentAutoShownReadProbe: [false, { option: true }],
  agentConsentAccepted: [true, { option: true }],
  agentConsentReads: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  },
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
  agentRetryAfter: [undefined, { option: true }],
  crdtDebugEnabled: [false, { option: true }],
  objectInfo: [undefined, { option: true }],
  page: async (
    {
      agentAutoShownReadProbe,
      agentConsentAccepted,
      agentConsentReads,
      agentConsentSave,
      agentConsentWrites,
      agentFlagEnabled,
      agentPanelInitiallyOpen,
      agentOnboardingCompleted,
      agentRetryAfter,
      agentBilling,
      acceptedTurns,
      crdtDebugEnabled,
      initialFeatureFlags,
      initialSettings,
      objectInfo,
      page,
      postedMessages
    },
    use,
    testInfo
  ) => {
    await mockAgentBoot(page, {
      agentAutoShownReadProbe,
      agentConsentAccepted,
      agentConsentReads,
      agentConsentSave,
      agentConsentWrites,
      agentFlagEnabled,
      agentPanelInitiallyOpen,
      agentOnboardingCompleted,
      agentRetryAfter,
      agentBilling,
      acceptedTurns,
      crdtDebugEnabled,
      initialFeatureFlags,
      initialSettings,
      objectInfo,
      postedMessages,
      vueNodes: testInfo.tags.includes('@vue-nodes')
    })
    await use(page)
  },
  postedMessages: async ({ agentFlagEnabled: _agentFlagEnabled }, use) => {
    await use([])
  }
})
