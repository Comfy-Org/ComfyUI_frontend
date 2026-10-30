import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import { REPORTED_ERROR_PREFIX } from '@comfyorg/shared-frontend-utils/telemetry'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = '3b7e2d1c-9a4f-4e6b-8c5d-1f2a3b4c5d6e'
const TURN_ID = '6c5d4e3f-2a1b-4c9d-8e7f-0a1b2c3d4e5f'
const WORKFLOW_ID = '0d9c8b7a-6f5e-4d3c-b2a1-f0e9d8c7b6a5'
const TWIN_WORKFLOW_ID = '1e0d9c8b-7a6f-4e5d-c3b2-a1f0e9d8c7b6'
const WORKFLOW_NAME = 'Image and video'
const THREAD_TITLE = 'Lighthouse clip'
const USER_REQUEST = 'Make a lighthouse image, then a short video of it'
const IMAGE_URL =
  'https://cloud.comfy.org/api/view?filename=lighthouse_00001_.png&subfolder=agent%2Foutputs&type=output'
const VIDEO_URL =
  'https://cloud.comfy.org/api/view?filename=lighthouse_00001_.mp4&subfolder=agent%2Foutputs&type=output'
const ASSISTANT_REPLY = `Here is the image: [lighthouse_00001_.png](${IMAGE_URL}) and the video: [lighthouse_00001_.mp4](${VIDEO_URL})`
const SAVED_AT = '2026-10-15T10:00:00Z'

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
  data: [WORKFLOW_ID, TWIN_WORKFLOW_ID].map((id) => ({
    id,
    name: WORKFLOW_NAME,
    created_at: SAVED_AT,
    updated_at: SAVED_AT,
    created_by: 'test-user-e2e',
    latest_version: 1
  })),
  pagination: { offset: 0, limit: 100, total: 2, has_more: false }
}
const SAVED_FILES: UserDataFullInfo[] = [
  `${WORKFLOW_NAME}.json`,
  `drafts/${WORKFLOW_NAME}.json`
].map((path) => ({ path, modified: Date.parse(SAVED_AT), size: 64 }))

test.describe(
  'Agent history reports an unresolvable chat workflow',
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
          await page.route('**/api/userdata?*', (route) => {
            const dir = new URL(route.request().url()).searchParams.get('dir')
            if (dir !== 'workflows') return route.fallback()
            return route.fulfill(jsonRoute(SAVED_FILES))
          })
        }
      })
    })

    test('logs why a chat whose workflow cannot be resolved does not open', async ({
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root
      const historyRow = panel.getByRole('button', {
        name: THREAD_TITLE,
        exact: true
      })
      using consoleErrors = collectConsoleErrors(page)

      await agentPanel.open()
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()
      await historyRow.click()

      await expect(panel.getByRole('alert')).toHaveText(
        enMessages.agent.historyOpenFailed
      )
      await expect
        .poll(() =>
          consoleErrors.errors.filter((error) =>
            error.startsWith(
              `${REPORTED_ERROR_PREFIX}agent_workflow_restore_failed`
            )
          )
        )
        .toHaveLength(1)
    })
  }
)
