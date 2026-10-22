import type { AgentRunMode, JobsListResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  MARKDOWN_BODY,
  MARKDOWN_HEADING,
  MARKDOWN_ID,
  MARKDOWN_TEXT,
  NOTE_ID,
  NOTE_TEXT,
  SAVED_NAME,
  SERVED_MARKDOWN_HEADING,
  SERVED_NOTE_TEXT,
  VIRTUAL_NODE_ADDS
} from '@e2e/fixtures/data/agent/agentVirtualNoteNodes'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe(
  'Agent adds frontend-only note nodes',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-set-widget-existing' })

    test.beforeEach(async ({ page }) => {
      const folders: ModelFolderInfo[] = []
      await page.route('**/api/experiment/models', (route) =>
        route.fulfill(jsonRoute(folders))
      )
      const jobs: JobsListResponse = {
        jobs: [],
        pagination: { offset: 0, limit: 200, total: 0, has_more: false }
      }
      await page.route('**/api/jobs?*', (route) =>
        route.fulfill(jsonRoute(jobs))
      )
      const runMode: AgentRunMode = { mode: 'ask_approval', credit_limit: null }
      await page.route('**/api/agent/run-mode', (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        return route.fulfill(jsonRoute(runMode))
      })
    })

    test('renders Note and MarkdownNote with their own text, and keeps both across a tab switch and a reload', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(120_000)
      const { topbar, vueNodes } = agentConversation
      const noteText = () =>
        vueNodes.getNodeLocator(String(NOTE_ID)).getByLabel('text', {
          exact: true
        })
      const markdownText = () =>
        vueNodes.getNodeLocator(String(MARKDOWN_ID)).getByLabel('text', {
          exact: true
        })

      const expectBothNotes = async (
        note = NOTE_TEXT,
        heading = MARKDOWN_HEADING
      ) => {
        await expect(noteText()).toHaveValue(note)
        await expect(
          markdownText().getByRole('heading', {
            name: heading,
            level: 1,
            exact: true
          })
        ).toBeVisible()
        await expect(markdownText()).toContainText(MARKDOWN_BODY)
        await expect(markdownText()).not.toContainText(note)
      }

      await test.step('host adds a Note and a MarkdownNote', async () => {
        await agentConversation.persistSavedWorkflow()
        await agentConversation.runTurns()
        agentConversation.pushHostOps(VIRTUAL_NODE_ADDS)
        await expectBothNotes()
      })

      await test.step('both survive switching tabs away and back', async () => {
        const before = agentConversation.subscribeCount()
        await topbar.openBlankTabAndReturn()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBe(before + 1)
        await expectBothNotes()
        await agentConversation.panel.hover()
      })

      await test.step('the saved workflow file carries both notes', async () => {
        await topbar.saveWorkflowAs(SAVED_NAME)
        await expect(topbar.getActiveTab()).toContainText(SAVED_NAME)
        await expect
          .poll(() => agentConversation.savedWorkflowPath())
          .toContain(SAVED_NAME)
        const savedNodes = (await agentConversation.savedWorkflowContent())
          .nodes
        expect(savedNodes.find((node) => node.id === NOTE_ID)).toMatchObject({
          type: 'Note',
          widgets_values: [NOTE_TEXT]
        })
        expect(
          savedNodes.find((node) => node.id === MARKDOWN_ID)
        ).toMatchObject({
          type: 'MarkdownNote',
          widgets_values: [MARKDOWN_TEXT]
        })
      })

      await test.step('both survive reload and reopen without host replay', async () => {
        agentConversation.refuseHostSubscribes()
        agentConversation.replaceInSavedWorkflow(NOTE_TEXT, SERVED_NOTE_TEXT)
        agentConversation.replaceInSavedWorkflow(
          MARKDOWN_HEADING,
          SERVED_MARKDOWN_HEADING
        )
        const restoredContent = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            decodeURIComponent(new URL(response.url()).pathname) ===
              `/api/userdata/workflows/${SAVED_NAME}.json`,
          { timeout: 60_000 }
        )
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(agentConversation.panel).toBeVisible({ timeout: 30_000 })
        await new AgentPanel(page).selectWorkflow(SAVED_NAME)
        expect((await restoredContent).ok()).toBe(true)
        await expectBothNotes(SERVED_NOTE_TEXT, SERVED_MARKDOWN_HEADING)
        const afterPath = testInfo.outputPath('after-reload.png')
        await page.screenshot({ path: afterPath })
        await testInfo.attach('after-reload', {
          path: afterPath,
          contentType: 'image/png'
        })
      })
    })
  }
)
