import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * PM-1257 / PM-1270: activating a workflow tab has to bring up that workflow's
 * chat, and a chat the user picked by hand has to survive the thread-list
 * refresh that the pick itself triggers.
 */
const PORTRAIT_WORKFLOW_ID = 'f0e1d2c3-4b5a-4968-8776-5a4b3c2d1e0f'
const LANDSCAPE_WORKFLOW_ID = 'b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8a9b'
const PORTRAIT_THREAD_ID = 'c4a7e2d1-5b3f-4e6a-9c8d-1f2a3b4c5d6e'
const LANDSCAPE_THREAD_ID = 'e1f2a3b4-6c5d-4e7f-8a9b-0c1d2e3f4a5b'
const UNBOUND_THREAD_ID = 'a1b2c3d4-7e8f-4901-8b2c-3d4e5f6a7b8c'
const PORTRAIT_NAME = 'Portrait Study'
const LANDSCAPE_NAME = 'Landscape Study'
const PORTRAIT_REQUEST = 'Tidy up the portrait study'
const LANDSCAPE_REQUEST = 'Widen the landscape study'
const UNBOUND_REQUEST = 'What does a KSampler do?'
const AT = '2026-09-22T10:00:00Z'

const EMPTY_WORKFLOW: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

const savedFiles: UserDataFullInfo[] = [PORTRAIT_NAME, LANDSCAPE_NAME].map(
  (name) => ({
    path: `${name}.json`,
    modified: Date.parse(AT),
    size: JSON.stringify(EMPTY_WORKFLOW).length
  })
)

function thread(
  id: string,
  title: string,
  preview: string,
  workflowId: string
): AgentThreadListResponse['threads'][number] {
  return {
    id,
    title,
    preview,
    workflow_id: workflowId,
    status: 'active',
    message_count: 1,
    created_at: AT,
    updated_at: AT,
    last_message_at: AT
  }
}

function transcript(
  threadId: string,
  workflowId: string,
  text: string
): AgentMessage[] {
  return [
    {
      id: `${threadId}-user`,
      thread_id: threadId,
      turn_id: `${threadId}-turn`,
      seq: 1,
      role: 'user',
      status: 'complete',
      workflow_id: workflowId,
      content: { text }
    }
  ]
}

const TRANSCRIPTS: Record<string, AgentMessage[]> = {
  [PORTRAIT_THREAD_ID]: transcript(
    PORTRAIT_THREAD_ID,
    PORTRAIT_WORKFLOW_ID,
    PORTRAIT_REQUEST
  ),
  [LANDSCAPE_THREAD_ID]: transcript(
    LANDSCAPE_THREAD_ID,
    LANDSCAPE_WORKFLOW_ID,
    LANDSCAPE_REQUEST
  ),
  [UNBOUND_THREAD_ID]: transcript(UNBOUND_THREAD_ID, '', UNBOUND_REQUEST)
}

const cloudWorkflows: WorkflowListResponse = {
  data: [
    { id: PORTRAIT_WORKFLOW_ID, name: PORTRAIT_NAME },
    { id: LANDSCAPE_WORKFLOW_ID, name: LANDSCAPE_NAME }
  ].map(({ id, name }) => ({
    id,
    name,
    created_at: AT,
    updated_at: AT,
    created_by: 'test-user-e2e',
    latest_version: 1
  })),
  pagination: { offset: 0, limit: 100, total: 2, has_more: false }
}

const threads: AgentThreadListResponse = {
  threads: [
    thread(
      PORTRAIT_THREAD_ID,
      'Portrait chat',
      PORTRAIT_REQUEST,
      PORTRAIT_WORKFLOW_ID
    ),
    thread(
      LANDSCAPE_THREAD_ID,
      'Landscape chat',
      LANDSCAPE_REQUEST,
      LANDSCAPE_WORKFLOW_ID
    ),
    thread(UNBOUND_THREAD_ID, 'Unbound chat', UNBOUND_REQUEST, '')
  ],
  pagination: { offset: 0, limit: 100, total: 3, has_more: false }
}

test.describe(
  'Agent chat follows the active workflow tab',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('brings up the tab’s chat on activation and keeps a hand-picked chat', async ({
      page,
      agentFlagEnabled
    }) => {
      // Every history pick refreshes the thread list, and that refresh is what
      // used to re-assert the active tab's chat. Counting the refreshes gives
      // the "it stayed" assertion something real to wait for.
      let threadListReads = 0
      await page.routeWebSocket(/\/ws/, (ws) => {
        ws.send(
          JSON.stringify({
            type: 'status',
            data: { status: { exec_info: { queue_remaining: 0 } } }
          })
        )
      })

      await bootAgentApp(page, agentFlagEnabled, {
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads', (route) => {
            threadListReads += 1
            return route.fulfill(jsonRoute(threads))
          })
          await page.route('**/api/agent/threads/*/messages', (route) => {
            if (route.request().method() !== 'GET') return route.fallback()
            const threadId = new URL(route.request().url()).pathname.split(
              '/'
            )[4]
            return route.fulfill(jsonRoute(TRANSCRIPTS[threadId] ?? []))
          })
          await page.route('**/api/workflows?*', (route) =>
            route.fulfill(jsonRoute(cloudWorkflows))
          )
          await page.route('**/api/userdata?*', (route) => {
            const dir = new URL(route.request().url()).searchParams.get('dir')
            if (dir !== 'workflows') return route.fallback()
            return route.fulfill(jsonRoute(savedFiles))
          })
          await page.route('**/api/userdata/*', (route) => {
            const request = route.request()
            const path = decodeURIComponent(
              new URL(request.url()).pathname.split('/userdata/')[1]
            )
            if (
              request.method() !== 'GET' ||
              !path.startsWith('workflows/') ||
              !savedFiles.some((file) => path === `workflows/${file.path}`)
            )
              return route.fallback()
            return route.fulfill(jsonRoute(EMPTY_WORKFLOW))
          })
        }
      })

      const topbar = new Topbar(page)
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const transcriptBubbles = panel.getByTestId('user-message-bubble')
      const historyButton = panel.getByRole('button', {
        name: enMessages.agent.showChatHistory
      })
      const chatRow = (title: string) =>
        panel.getByRole('button', { name: title, exact: true })

      async function openChat(title: string, request: string): Promise<void> {
        await historyButton.click()
        await expect(chatRow(title)).toBeEnabled()
        await chatRow(title).click()
        await expect(transcriptBubbles).toHaveText([request])
      }

      await test.step('each chat opens a tab for the workflow it is bound to', async () => {
        await openChat('Portrait chat', PORTRAIT_REQUEST)
        await expect(topbar.getWorkflowTab(PORTRAIT_NAME)).toBeVisible()
        await openChat('Landscape chat', LANDSCAPE_REQUEST)
        await expect(
          topbar.getWorkflowTab(LANDSCAPE_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('activating the portrait tab brings up the portrait chat', async () => {
        await topbar.getWorkflowTab(PORTRAIT_NAME).click()
        await expect(
          topbar.getWorkflowTab(PORTRAIT_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
        await expect(transcriptBubbles).toHaveText([PORTRAIT_REQUEST])
      })

      await test.step('a hand-picked chat with no workflow of its own survives the refresh', async () => {
        const readsBeforePick = threadListReads
        // The regression re-reads the portrait transcript to put the active
        // tab's chat back. Arm the listener before the pick so neither outcome
        // can win on timing.
        const refetchedPortrait = page
          .waitForRequest(
            (request) =>
              request
                .url()
                .includes(`/api/agent/threads/${PORTRAIT_THREAD_ID}/messages`),
            { timeout: 5000 }
          )
          .then(() => 'the portrait chat was loaded again')
          .catch(() => null)
        await openChat('Unbound chat', UNBOUND_REQUEST)
        await expect
          .poll(() => threadListReads, { message: 'thread list refreshed' })
          .toBeGreaterThan(readsBeforePick)
        expect(await refetchedPortrait).toBeNull()
        await expect(transcriptBubbles).toHaveText([UNBOUND_REQUEST])
        await expect(
          topbar.getWorkflowTab(PORTRAIT_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
      })
    })
  }
)
