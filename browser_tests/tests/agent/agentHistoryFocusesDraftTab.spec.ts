import { expect } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

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

const DRAFT_THREAD_ID = 'c4a7e2d1-5b3f-4e6a-9c8d-1f2a3b4c5d6e'
const OTHER_THREAD_ID = 'e1f2a3b4-6c5d-4e7f-8a9b-0c1d2e3f4a5b'
const DRAFT_WORKFLOW_ID = 'a9b8c7d6-2e1f-4a3b-8c5d-6e7f8a9b0c1d'
const SAVED_WORKFLOW_ID = 'f0e1d2c3-4b5a-4968-8776-5a4b3c2d1e0f'
const DRAFT_TAB_NAME = 'Lighting study'
const SAVED_WORKFLOW_NAME = 'Portrait Study'
const SAVED_WORKFLOW_PATH = `workflows/${SAVED_WORKFLOW_NAME}.json`
const DRAFT_REQUEST = 'Build me a three-point lighting rig'
const OTHER_REQUEST = 'Tidy up the portrait study'
const AT = '2026-09-11T10:00:00Z'

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

const savedFiles: UserDataFullInfo[] = [
  {
    path: SAVED_WORKFLOW_PATH.slice('workflows/'.length),
    modified: Date.parse(AT),
    size: JSON.stringify(EMPTY_WORKFLOW).length
  }
]

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

// A workflow the agent minted for itself and the user never saved has no row
// in `GET /api/workflows`: cloud's `common/workflow/repository.go` filters
// `List` on `LatestVersionIDNotNil`, deliberately hiding version-less rows
// until a save or run promotes them. So that listing can never testify about
// a draft, and its silence is not evidence of deletion.
//
// Returning to such a chat used to read that silence as deletion and answer
// "The target workflow is no longer available" — while the draft's tab sat
// open in the topbar, one click away. The chat must focus that tab instead.
//
// The sibling case is pinned by `agentDeletedTargetNotice.spec.ts` and by the
// second case here: when nothing local owns the id, the unavailable notice is
// still the right and only answer. There is no recover-into-a-new-workflow
// path to offer, because the draft snapshot is the sole content source for
// these workflows and `GET /api/agent/draft` authorizes against a live row —
// cloud's soft-delete mixin adds `deleted_at IS NULL` to every workflow query,
// so a deleted workflow's draft answers 403, not content.
//
// Narrower, backend-free coverage of the same decision lives in
// `useAgentWorkflowSelection.test.ts` ("focuses the unsaved draft tab this
// chat owns when the listing cannot carry it").
test.describe(
  'Agent history returns to a chat whose draft tab is open',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('focuses the open draft tab instead of calling the target unavailable', async ({
      page,
      agentFlagEnabled
    }) => {
      test.setTimeout(60_000)

      // The user's workflow list carries only the saved workflow. The draft the
      // agent minted is version-less, so it is absent by design.
      const cloudWorkflows: WorkflowListResponse = {
        data: [
          {
            id: SAVED_WORKFLOW_ID,
            name: SAVED_WORKFLOW_NAME,
            created_at: AT,
            updated_at: AT,
            created_by: 'test-user-e2e',
            latest_version: 1
          }
        ],
        pagination: { offset: 0, limit: 100, total: 1, has_more: false }
      }
      const threads: AgentThreadListResponse = {
        threads: [
          thread(
            DRAFT_THREAD_ID,
            'Lighting chat',
            DRAFT_REQUEST,
            DRAFT_WORKFLOW_ID
          ),
          thread(
            OTHER_THREAD_ID,
            'Portrait chat',
            OTHER_REQUEST,
            SAVED_WORKFLOW_ID
          )
        ],
        pagination: { offset: 0, limit: 100, total: 2, has_more: false }
      }
      let draftReads = 0

      let socket: WebSocketRoute | undefined
      await page.routeWebSocket(/\/ws/, (ws) => {
        socket = ws
        // Every real connect sends one; the panel waits for it before it
        // treats the socket as live.
        ws.send(
          JSON.stringify({
            type: 'status',
            data: { status: { exec_info: { queue_remaining: 0 } } }
          })
        )
      })

      await bootAgentApp(page, agentFlagEnabled, {
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads', (route) =>
            route.fulfill(jsonRoute(threads))
          )
          await page.route('**/api/agent/threads/*/messages', (route) => {
            if (route.request().method() !== 'GET') return route.fallback()
            const threadId = new URL(route.request().url()).pathname.split(
              '/'
            )[4]
            return route.fulfill(
              jsonRoute(
                threadId === OTHER_THREAD_ID
                  ? transcript(
                      OTHER_THREAD_ID,
                      SAVED_WORKFLOW_ID,
                      OTHER_REQUEST
                    )
                  : transcript(
                      DRAFT_THREAD_ID,
                      DRAFT_WORKFLOW_ID,
                      DRAFT_REQUEST
                    )
              )
            )
          })
          await page.route('**/api/workflows?*', (route) =>
            route.fulfill(jsonRoute(cloudWorkflows))
          )
          // The second chat's target is a genuinely saved workflow, so it has a
          // file to reopen from. Visiting it is only the way to leave the first
          // chat; a page reload reaches the same restoration.
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
            if (request.method() !== 'GET' || path !== SAVED_WORKFLOW_PATH)
              return route.fallback()
            return route.fulfill(jsonRoute(EMPTY_WORKFLOW))
          })
          // Nothing may try to rebuild the draft over HTTP: the open tab is
          // the live copy, so recovery has nothing to add and a fetch here
          // would mean a second tab was being materialized.
          await page.route('**/api/agent/draft*', (route) => {
            draftReads++
            return route.fulfill({ status: 404, body: '{}' })
          })
        }
      })

      const topbar = new Topbar(page)
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const unavailable = panel.getByText(
        enMessages.agent.targetWorkflowUnavailable
      )
      const historyButton = panel.getByRole('button', {
        name: enMessages.agent.showChatHistory
      })
      const draftRow = panel.getByRole('button', {
        name: 'Lighting chat',
        exact: true
      })
      const otherRow = panel.getByRole('button', {
        name: 'Portrait chat',
        exact: true
      })

      await test.step('the agent announces the draft it minted and the panel opens a tab for it', async () => {
        await expect(topbar.tabs).toHaveCount(1)
        if (!socket) throw new Error('the app never opened /ws')
        socket.send(
          JSON.stringify({
            type: 'agent_active_tab',
            data: { workflow_id: DRAFT_WORKFLOW_ID, name: DRAFT_TAB_NAME }
          })
        )
        await expect(topbar.getWorkflowTab(DRAFT_TAB_NAME)).toBeVisible()
        await expect(agentPanel.workflowPicker).toHaveText(DRAFT_TAB_NAME)
        await expect(unavailable).toBeHidden()
      })

      await test.step('the user visits another chat', async () => {
        await historyButton.click()
        await expect(otherRow).toBeEnabled()
        await otherRow.click()
        await expect(panel.getByTestId('user-message-bubble')).toHaveText([
          OTHER_REQUEST
        ])
        // That chat's own saved workflow opens its own tab, which is correct
        // and is the baseline the return trip must not add to.
        await expect(topbar.getWorkflowTab(SAVED_WORKFLOW_NAME)).toBeVisible()
      })

      const tabsBeforeReturn = await topbar.tabs.count()

      await test.step('returning to the lighting chat focuses its draft tab', async () => {
        await historyButton.click()
        await expect(draftRow).toBeEnabled()
        await draftRow.click()
        await expect(panel.getByTestId('user-message-bubble')).toHaveText([
          DRAFT_REQUEST
        ])
        await expect(unavailable).toBeHidden()
        await expect(agentPanel.workflowPicker).toHaveText(DRAFT_TAB_NAME)
        await expect(topbar.getActiveTab()).toContainText(DRAFT_TAB_NAME)
      })

      await test.step('no second tab was materialized for the same workflow', async () => {
        await expect(topbar.tabs).toHaveCount(tabsBeforeReturn)
        await expect(topbar.getWorkflowTab(DRAFT_TAB_NAME)).toHaveCount(1)
        expect(draftReads).toBe(0)
      })
    })

    test('still calls the target unavailable when nothing local owns the workflow', async ({
      page,
      agentFlagEnabled
    }) => {
      test.setTimeout(60_000)

      // The chat names a workflow the user deleted: absent from the listing,
      // and no tab of this session ever owned it.
      const cloudWorkflows: WorkflowListResponse = {
        data: [],
        pagination: { offset: 0, limit: 100, total: 0, has_more: false }
      }
      const threads: AgentThreadListResponse = {
        threads: [
          thread(
            DRAFT_THREAD_ID,
            'Lighting chat',
            DRAFT_REQUEST,
            DRAFT_WORKFLOW_ID
          )
        ],
        pagination: { offset: 0, limit: 100, total: 1, has_more: false }
      }
      let draftReads = 0

      await bootAgentApp(page, agentFlagEnabled, {
        beforeNavigate: async (page) => {
          await page.route('**/api/agent/threads', (route) =>
            route.fulfill(jsonRoute(threads))
          )
          await page.route('**/api/agent/threads/*/messages', (route) => {
            if (route.request().method() !== 'GET') return route.fallback()
            return route.fulfill(
              jsonRoute(
                transcript(DRAFT_THREAD_ID, DRAFT_WORKFLOW_ID, DRAFT_REQUEST)
              )
            )
          })
          await page.route('**/api/workflows?*', (route) =>
            route.fulfill(jsonRoute(cloudWorkflows))
          )
          // A deleted workflow's draft is unreadable anyway: the agent service
          // authorizes the snapshot against a live row. Counted so the pin
          // records that no recovery is attempted rather than merely failing.
          await page.route('**/api/agent/draft*', (route) => {
            draftReads++
            return route.fulfill({ status: 403, body: '{}' })
          })
        }
      })

      const topbar = new Topbar(page)
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const tabsBefore = await topbar.tabs.count()

      await test.step('the user selects the chat from history', async () => {
        await panel
          .getByRole('button', { name: enMessages.agent.showChatHistory })
          .click()
        const row = panel.getByRole('button', {
          name: 'Lighting chat',
          exact: true
        })
        await expect(row).toBeEnabled()
        await row.click()
        await expect(panel.getByTestId('user-message-bubble')).toHaveText([
          DRAFT_REQUEST
        ])
      })

      await test.step('the chat says the workflow is gone and offers no recovered copy', async () => {
        await expect(
          panel.getByText(enMessages.agent.targetWorkflowUnavailable)
        ).toBeVisible()
        await expect(agentPanel.workflowPicker).toHaveText(
          enMessages.agent.selectWorkflowForAgent
        )
        await expect(topbar.tabs).toHaveCount(tabsBefore)
        expect(draftReads).toBe(0)
      })
    })
  }
)
