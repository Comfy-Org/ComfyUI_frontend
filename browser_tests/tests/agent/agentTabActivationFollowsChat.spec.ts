import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import {
  agentThreadSummary,
  agentUserTranscript
} from '@e2e/fixtures/data/agent/agentThreadList'
import { AgentWorkflowChatsMock } from '@e2e/fixtures/helpers/agentWorkflowChats'

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
const LANDSCAPE_DRAFT = 'Now add a sunset'

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

test.describe(
  'Agent chat follows the active workflow tab',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('brings up the tab’s chat on activation unless a chat is picked or drafted', async ({
      page,
      agentFlagEnabled
    }) => {
      const chats = new AgentWorkflowChatsMock({
        workflows: [
          {
            id: PORTRAIT_WORKFLOW_ID,
            name: PORTRAIT_NAME,
            content: EMPTY_WORKFLOW
          },
          {
            id: LANDSCAPE_WORKFLOW_ID,
            name: LANDSCAPE_NAME,
            content: EMPTY_WORKFLOW
          }
        ],
        threads: [
          agentThreadSummary(PORTRAIT_THREAD_ID, 'Portrait chat', {
            preview: PORTRAIT_REQUEST,
            workflow_id: PORTRAIT_WORKFLOW_ID
          }),
          agentThreadSummary(LANDSCAPE_THREAD_ID, 'Landscape chat', {
            preview: LANDSCAPE_REQUEST,
            workflow_id: LANDSCAPE_WORKFLOW_ID
          }),
          agentThreadSummary(UNBOUND_THREAD_ID, 'Unbound chat', {
            preview: UNBOUND_REQUEST
          })
        ],
        transcripts: {
          [PORTRAIT_THREAD_ID]: agentUserTranscript(
            PORTRAIT_THREAD_ID,
            PORTRAIT_WORKFLOW_ID,
            PORTRAIT_REQUEST
          ),
          [LANDSCAPE_THREAD_ID]: agentUserTranscript(
            LANDSCAPE_THREAD_ID,
            LANDSCAPE_WORKFLOW_ID,
            LANDSCAPE_REQUEST
          ),
          [UNBOUND_THREAD_ID]: agentUserTranscript(
            UNBOUND_THREAD_ID,
            '',
            UNBOUND_REQUEST
          )
        }
      })
      await page.routeWebSocket(/\/ws/, (ws) => {
        ws.send(
          JSON.stringify({
            type: 'status',
            data: { status: { exec_info: { queue_remaining: 0 } } }
          })
        )
      })

      await bootAgentApp(page, agentFlagEnabled, {
        beforeNavigate: (page) => chats.route(page)
      })

      const topbar = new Topbar(page)
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const transcriptBubbles = agentPanel.userMessageBubbles

      await test.step('each chat opens a tab for the workflow it is bound to', async () => {
        await agentPanel.openChatFromHistory('Portrait chat')
        await expect(transcriptBubbles).toHaveText([PORTRAIT_REQUEST])
        await expect(topbar.getWorkflowTab(PORTRAIT_NAME)).toBeVisible()
        await agentPanel.openChatFromHistory('Landscape chat')
        await expect(transcriptBubbles).toHaveText([LANDSCAPE_REQUEST])
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
        const readsBeforePick = chats.threadListReads
        await agentPanel.openChatFromHistory('Unbound chat')
        await expect(transcriptBubbles).toHaveText([UNBOUND_REQUEST])
        await expect
          .poll(() => chats.threadListReads, {
            message: 'thread list refreshed'
          })
          .toBeGreaterThan(readsBeforePick)
        await expect(
          expect(transcriptBubbles).toHaveText([PORTRAIT_REQUEST], {
            timeout: 3000
          })
        ).rejects.toThrow()
        await expect(transcriptBubbles).toHaveText([UNBOUND_REQUEST])
        await expect(
          topbar.getWorkflowTab(PORTRAIT_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('a draft keeps the open chat when another tab is activated', async () => {
        await agentPanel.openChatFromHistory('Landscape chat')
        await expect(transcriptBubbles).toHaveText([LANDSCAPE_REQUEST])
        await expect(
          topbar.getWorkflowTab(LANDSCAPE_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
        await agentPanel.composer.fill(LANDSCAPE_DRAFT)

        await topbar.getWorkflowTab(PORTRAIT_NAME).click()

        await expect(
          topbar.getWorkflowTab(PORTRAIT_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
        await expect(panel.getByRole('note')).toContainText(
          enMessages.agent.viewingDifferentWorkflow
        )
        await expect(
          expect(transcriptBubbles).toHaveText([PORTRAIT_REQUEST], {
            timeout: 3000
          })
        ).rejects.toThrow()
        await expect(transcriptBubbles).toHaveText([LANDSCAPE_REQUEST])
        await expect(agentPanel.composer).toHaveText(LANDSCAPE_DRAFT)
      })
    })
  }
)
