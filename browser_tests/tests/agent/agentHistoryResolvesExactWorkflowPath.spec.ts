import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse,
  WorkflowSidebarFileResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@comfyorg/api-client/types'

import savedWorkflow from '@e2e/assets/nodes/note_nodes.json' with { type: 'json' }
import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import type { WorkspaceStore } from '@e2e/types/globals'

const THREAD_ID = '3b7e2d1c-9a4f-4e6b-8c5d-1f2a3b4c5d6e'
const TURN_ID = '6c5d4e3f-2a1b-4c9d-8e7f-0a1b2c3d4e5f'
const WORKFLOW_ID = '0d9c8b7a-6f5e-4d3c-b2a1-f0e9d8c7b6a5'
const WORKFLOW_NAME = 'Image and video'
const THREAD_TITLE = 'Lighthouse clip'
const USER_REQUEST = 'Make a lighthouse image, then a short video of it'
const IMAGE_URL =
  'https://cloud.comfy.org/api/view?filename=lighthouse_00001_.png&subfolder=agent%2Foutputs&type=output'
const VIDEO_URL =
  'https://cloud.comfy.org/api/view?filename=lighthouse_00001_.mp4&subfolder=agent%2Foutputs&type=output'
const ASSISTANT_REPLY = `Here is the image: [lighthouse_00001_.png](${IMAGE_URL}) and the video: [lighthouse_00001_.mp4](${VIDEO_URL})`
const SAVED_AT = '2026-10-15T10:00:00Z'
const EXACT_PATH = `workflows/drafts/${WORKFLOW_NAME}.json`

const THREADS: AgentThreadListResponse = {
  threads: [
    {
      id: THREAD_ID,
      title: THREAD_TITLE,
      preview: USER_REQUEST,
      workflow_id: WORKFLOW_ID,
      status: 'active',
      message_count: 2,
      created_at: SAVED_AT,
      updated_at: SAVED_AT,
      last_message_at: SAVED_AT
    }
  ],
  pagination: { offset: 0, limit: 100, total: 1, has_more: false }
}
const TRANSCRIPT: AgentMessage[] = [
  {
    id: 'lighthouse-user',
    thread_id: THREAD_ID,
    turn_id: TURN_ID,
    seq: 1,
    role: 'user',
    status: 'complete',
    workflow_id: WORKFLOW_ID,
    content: { text: USER_REQUEST }
  },
  {
    id: TURN_ID,
    thread_id: THREAD_ID,
    turn_id: TURN_ID,
    seq: 2,
    role: 'assistant',
    status: 'complete',
    workflow_id: WORKFLOW_ID,
    content: {
      text: ASSISTANT_REPLY,
      tool_calls: [
        {
          id: 'call-image',
          tool_call_id: 'toolu_image',
          tool_name: 'run_workflow',
          status: 'success',
          duration_ms: 4200
        },
        {
          id: 'call-video',
          tool_call_id: 'toolu_video',
          tool_name: 'run_workflow',
          status: 'success',
          duration_ms: 18400
        }
      ]
    }
  }
]
const CLOUD_WORKFLOWS: WorkflowListResponse = {
  data: [
    {
      id: WORKFLOW_ID,
      name: WORKFLOW_NAME,
      created_at: SAVED_AT,
      updated_at: SAVED_AT,
      created_by: 'test-user-e2e',
      latest_version: 1
    }
  ],
  pagination: { offset: 0, limit: 100, total: 1, has_more: false }
}
const SAVED_FILES: UserDataFullInfo[] = [
  `${WORKFLOW_NAME}.json`,
  `drafts/${WORKFLOW_NAME}.json`
].map((path) => ({ path, modified: Date.parse(SAVED_AT), size: 64 }))
const SIDEBAR_FILE: WorkflowSidebarFileResponse = {
  path: EXACT_PATH,
  modified: Date.parse(SAVED_AT),
  size: JSON.stringify(savedWorkflow).length
}

test.describe(
  'PM-2610 Agent history resolves the chat workflow by exact saved path',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      await bootAgentApp(page, agentFlagEnabled, {
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads?*', (route) =>
            route.fulfill(jsonRoute(THREADS))
          )
          await page.route('**/api/agent/threads/*/messages', (route) =>
            route.request().method() === 'GET'
              ? route.fulfill(jsonRoute(TRANSCRIPT))
              : route.fallback()
          )
          await page.route('**/api/workflows?*', (route) =>
            route.fulfill(jsonRoute(CLOUD_WORKFLOWS))
          )
          await page.route(
            `**/api/workflows/${WORKFLOW_ID}/sidebar-file`,
            (route) => route.fulfill(jsonRoute(SIDEBAR_FILE))
          )
          await page.route('**/api/userdata?*', (route) => {
            const dir = new URL(route.request().url()).searchParams.get('dir')
            if (dir !== 'workflows') return route.fallback()
            return route.fulfill(jsonRoute(SAVED_FILES))
          })
          await page.route('**/api/userdata/**', (route) => {
            const path = decodeURIComponent(
              new URL(route.request().url()).pathname
            )
            if (path !== `/api/userdata/${EXACT_PATH}`) return route.fallback()
            return route.fulfill(jsonRoute(savedWorkflow))
          })
        }
      })
    })

    test('opens a chat when duplicate local filenames require its exact sidebar path', async ({
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root
      const historyRow = panel.getByRole('button', {
        name: THREAD_TITLE,
        exact: true
      })
      await agentPanel.open()
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()
      await historyRow.click()

      await expect(panel.getByText(USER_REQUEST, { exact: true })).toBeVisible()
      await expect(
        panel.getByRole('link', { name: 'lighthouse_00001_.png' })
      ).toBeVisible()
      await expect(
        panel.getByRole('link', { name: 'lighthouse_00001_.mp4' })
      ).toBeVisible()
      await expect(
        panel.getByText(enMessages.agent.historyOpenFailed)
      ).toHaveCount(0)
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window.app!.extensionManager as WorkspaceStore).workflow
                .activeWorkflow?.path
          )
        )
        .toBe(EXACT_PATH)
    })

    test('PM-2624 shows only the unreadable-workflow notice when the chat target is damaged', async ({
      page,
      toast
    }) => {
      await page.route('**/api/userdata/**', (route) => {
        const path = decodeURIComponent(new URL(route.request().url()).pathname)
        if (path !== `/api/userdata/${EXACT_PATH}`) return route.fallback()
        return route.fulfill(jsonRoute(null))
      })
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root

      await agentPanel.open()
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()
      await panel
        .getByRole('button', { name: THREAD_TITLE, exact: true })
        .click()

      await expect(
        toast.withText(enMessages.workflowService.unreadableWorkflowTitle)
      ).toBeVisible()
      await expect(panel.getByText(USER_REQUEST, { exact: true })).toBeVisible()
      await expect(
        panel.getByText(enMessages.agent.historyOpenFailed)
      ).toHaveCount(0)
      await expect(toast.visibleToasts).toHaveCount(1)
    })
  }
)
