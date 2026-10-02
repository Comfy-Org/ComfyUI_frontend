import { expect } from '@playwright/test'

import type {
  AgentGetDraftResponse,
  AgentMessage,
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = '5d0c9a4e-2b1f-4c3d-8e7f-6a5b4c3d2e1f'
const TURN_ID = '7e1d0b5f-3c2a-4d4e-9f8a-7b6c5d4e3f2a'
const SAVED_WORKFLOW_ID = '9f2e1c6a-4d3b-4e5f-a0b1-c2d3e4f5a6b7'
const THREAD_TITLE = 'Portrait chat'
const USER_REQUEST = 'Warm up the key light on my portrait study'
const ASSISTANT_REPLY = 'The key light now sits at a warmer angle.'
const SAVED_WORKFLOW_NAME = 'Portrait Study'
const SAVED_WORKFLOW_PATH = `workflows/${SAVED_WORKFLOW_NAME}.json`
const SAVED_AT = '2026-09-11T10:00:00Z'
const MARKER_NODE_TYPE = 'PortraitLightingRig'
// Only the saved workflow's content carries a node with this title; the
// default tab the app boots into never does.
const MARKER_TITLE = 'Portrait key light'

const NODE_DEFINITIONS: Record<string, ComfyNodeDef> = {
  [MARKER_NODE_TYPE]: {
    name: MARKER_NODE_TYPE,
    display_name: 'Portrait Lighting Rig',
    description: '',
    category: 'testing',
    python_module: 'testing',
    output_node: false,
    input: { required: {} },
    output: [],
    output_is_list: [],
    output_name: []
  }
}

const SAVED_WORKFLOW: ComfyWorkflowJSON = {
  last_node_id: 1,
  last_link_id: 0,
  nodes: [
    {
      id: 1,
      type: MARKER_NODE_TYPE,
      title: MARKER_TITLE,
      pos: [360, 240],
      size: [260, 60],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {}
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: { ds: { offset: [0, 0], scale: 1 } },
  version: 0.4
}

// ADR-AGENT-HISTORY-0038: selecting a historical chat whose saved target
// workflow has no open tab reopens that saved workflow, and the history list
// stays on screen with a loading row until both the transcript and the
// workflow are ready. Only then is the conversation revealed, with the saved
// workflow on the canvas. Both readiness sources are held here in turn: the
// transcript first, then the saved workflow's file once the transcript has
// hydrated underneath the still-visible history list.
test.describe(
  'Agent history reopens a closed saved workflow',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('reveals the chat and its saved workflow only after both are ready', async ({
      page,
      agentFlagEnabled
    }) => {
      let releaseTranscript: () => void = () => {}
      const transcriptReleased = new Promise<void>((resolve) => {
        releaseTranscript = resolve
      })
      let releaseSavedWorkflow: () => void = () => {}
      const savedWorkflowReleased = new Promise<void>((resolve) => {
        releaseSavedWorkflow = resolve
      })
      let transcriptRequests = 0
      let savedWorkflowRequests = 0

      const threads: AgentThreadListResponse = {
        threads: [
          {
            id: THREAD_ID,
            title: THREAD_TITLE,
            preview: USER_REQUEST,
            workflow_id: SAVED_WORKFLOW_ID,
            status: 'active',
            message_count: 2,
            created_at: SAVED_AT,
            updated_at: SAVED_AT,
            last_message_at: SAVED_AT
          }
        ],
        pagination: { offset: 0, limit: 100, total: 1, has_more: false }
      }
      const transcript: AgentMessage[] = [
        {
          id: 'portrait-user',
          thread_id: THREAD_ID,
          turn_id: TURN_ID,
          seq: 1,
          role: 'user',
          status: 'complete',
          workflow_id: SAVED_WORKFLOW_ID,
          content: { text: USER_REQUEST }
        },
        {
          id: TURN_ID,
          thread_id: THREAD_ID,
          turn_id: TURN_ID,
          seq: 2,
          role: 'assistant',
          status: 'complete',
          workflow_id: SAVED_WORKFLOW_ID,
          content: { text: ASSISTANT_REPLY }
        }
      ]
      const cloudWorkflows: WorkflowListResponse = {
        data: [
          {
            id: SAVED_WORKFLOW_ID,
            name: SAVED_WORKFLOW_NAME,
            created_at: SAVED_AT,
            updated_at: SAVED_AT,
            created_by: 'test-user-e2e',
            latest_version: 1
          }
        ],
        pagination: { offset: 0, limit: 100, total: 1, has_more: false }
      }
      const savedFiles: UserDataFullInfo[] = [
        {
          path: SAVED_WORKFLOW_PATH.slice('workflows/'.length),
          modified: Date.parse(SAVED_AT),
          size: JSON.stringify(SAVED_WORKFLOW).length
        }
      ]

      await bootAgentApp(page, agentFlagEnabled, {
        objectInfo: NODE_DEFINITIONS,
        // Registered after the boot mocks so these win over their userdata
        // stub: the saved workflow is in the user's workflow list from boot,
        // but its tab is never opened.
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads', (route) =>
            route.fulfill(jsonRoute(threads))
          )
          await page.route('**/api/agent/threads/*/messages', async (route) => {
            if (route.request().method() !== 'GET') return route.fallback()
            transcriptRequests++
            await transcriptReleased
            return route.fulfill(jsonRoute(transcript))
          })
          await page.route('**/api/workflows?*', (route) =>
            route.fulfill(jsonRoute(cloudWorkflows))
          )
          await page.route('**/api/userdata?*', (route) => {
            const dir = new URL(route.request().url()).searchParams.get('dir')
            if (dir !== 'workflows') return route.fallback()
            return route.fulfill(jsonRoute(savedFiles))
          })
          await page.route('**/api/userdata/*', async (route) => {
            const request = route.request()
            const path = decodeURIComponent(
              new URL(request.url()).pathname.split('/userdata/')[1]
            )
            if (request.method() !== 'GET' || path !== SAVED_WORKFLOW_PATH)
              return route.fallback()
            savedWorkflowRequests++
            await savedWorkflowReleased
            return route.fulfill(jsonRoute(SAVED_WORKFLOW))
          })
        }
      })

      const topbar = new Topbar(page)
      const savedWorkflowTab = topbar.getWorkflowTab(SAVED_WORKFLOW_NAME)
      const markerNode = new VueNodeHelpers(page).getNodeByTitle(MARKER_TITLE)
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root
      const historyHeading = panel.getByRole('heading', {
        name: enMessages.agent.history
      })
      const historyRow = panel.getByRole('button', {
        name: THREAD_TITLE,
        exact: true
      })
      const userBubbles = panel.getByTestId('user-message-bubble')
      const assistantReply = panel.getByText(ASSISTANT_REPLY, { exact: true })

      const expectSelectionStillLoading = async () => {
        await expect(historyHeading).toBeVisible()
        await expect(historyRow).toHaveAttribute('aria-busy', 'true')
        await expect(historyRow).toBeDisabled()
        await expect(userBubbles).toHaveCount(0)
        await expect(assistantReply).toBeHidden()
        await expect(markerNode).toHaveCount(0)
        await expect(savedWorkflowTab).toHaveCount(0)
      }

      await test.step('the saved workflow starts closed', async () => {
        await expect(topbar.tabs).toHaveCount(1)
        await expect(savedWorkflowTab).toHaveCount(0)
        await expect(markerNode).toHaveCount(0)
      })

      await test.step('the user selects the chat from history', async () => {
        await agentPanel.open()
        await panel
          .getByRole('button', { name: enMessages.agent.showChatHistory })
          .click()
        await expect(historyHeading).toBeVisible()
        await expect(historyRow).toBeEnabled()
        expect(savedWorkflowRequests).toBe(0)
        await historyRow.click()
      })

      await test.step('history keeps the row loading while the transcript is held', async () => {
        await expect.poll(() => transcriptRequests).toBe(1)
        await expectSelectionStillLoading()
      })

      await test.step('history keeps the row loading while the saved workflow is held', async () => {
        releaseTranscript()
        await expect.poll(() => savedWorkflowRequests).toBe(1)
        await expectSelectionStillLoading()
      })

      await test.step('the conversation opens with its saved workflow on the canvas', async () => {
        releaseSavedWorkflow()
        await expect(userBubbles).toHaveText([USER_REQUEST])
        await expect(assistantReply).toBeVisible()
        await expect(historyHeading).toBeHidden()
        await expect(markerNode).toBeVisible()
        await expect(topbar.getActiveTab()).toHaveText(SAVED_WORKFLOW_NAME)
        await expect(agentPanel.workflowPicker).toHaveText(SAVED_WORKFLOW_NAME)
      })
    })

    test('keeps an explicitly deleted target unavailable even when a stale draft remains', async ({
      page,
      agentFlagEnabled
    }) => {
      let draftRequests = 0
      let workflowRowRequests = 0
      const threads: AgentThreadListResponse = {
        threads: [
          {
            id: THREAD_ID,
            title: THREAD_TITLE,
            preview: USER_REQUEST,
            workflow_id: SAVED_WORKFLOW_ID,
            status: 'active',
            message_count: 2,
            created_at: SAVED_AT,
            updated_at: SAVED_AT,
            last_message_at: SAVED_AT
          }
        ],
        pagination: { offset: 0, limit: 100, total: 1, has_more: false }
      }
      const transcript: AgentMessage[] = [
        {
          id: 'portrait-user',
          thread_id: THREAD_ID,
          turn_id: TURN_ID,
          seq: 1,
          role: 'user',
          status: 'complete',
          workflow_id: SAVED_WORKFLOW_ID,
          content: { text: USER_REQUEST }
        },
        {
          id: TURN_ID,
          thread_id: THREAD_ID,
          turn_id: TURN_ID,
          seq: 2,
          role: 'assistant',
          status: 'complete',
          workflow_id: SAVED_WORKFLOW_ID,
          content: { text: ASSISTANT_REPLY }
        }
      ]
      const staleDraft: AgentGetDraftResponse = {
        content: SAVED_WORKFLOW,
        version: 1
      }

      await bootAgentApp(page, agentFlagEnabled, {
        objectInfo: NODE_DEFINITIONS,
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads', (route) =>
            route.fulfill(jsonRoute(threads))
          )
          await page.route('**/api/agent/threads/*/messages', (route) =>
            route.fulfill(jsonRoute(transcript))
          )
          await page.route('**/api/workflows?*', (route) =>
            route.fulfill(
              jsonRoute({
                data: [],
                pagination: {
                  offset: 0,
                  limit: 100,
                  total: 0,
                  has_more: false
                }
              } satisfies WorkflowListResponse)
            )
          )
          await page.route('**/api/userdata?*', (route) =>
            route.fulfill(jsonRoute([] satisfies UserDataFullInfo[]))
          )
          await page.route('**/api/agent/draft?*', (route) => {
            draftRequests++
            return route.fulfill(jsonRoute(staleDraft))
          })
          await page.route('**/api/workflows/*', (route) => {
            workflowRowRequests++
            return route.fulfill({
              status: 404,
              contentType: 'application/json',
              body: JSON.stringify({ code: 'NOT_FOUND', message: 'not found' })
            })
          })
        }
      })

      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()
      await panel.getByRole('button', { name: THREAD_TITLE }).click()

      await expect(panel.getByTestId('user-message-bubble')).toHaveText(
        USER_REQUEST
      )
      await expect(
        panel.getByText(enMessages.agent.targetWorkflowUnavailable)
      ).toBeVisible()
      await expect(agentPanel.workflowPicker).toHaveText(
        enMessages.agent.selectWorkflowForAgent
      )
      await expect(
        new VueNodeHelpers(page).getNodeByTitle(MARKER_TITLE)
      ).toHaveCount(0)
      await expect(
        new Topbar(page).getWorkflowTab(SAVED_WORKFLOW_NAME)
      ).toHaveCount(0)
      expect(draftRequests).toBe(1)
      expect(workflowRowRequests).toBe(1)
    })
  }
)
