import type { AgentRunMode, JobsListResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// Note and MarkdownNote are frontend-only nodes: the backend object_info never
// lists them, so the CRDT host stores their `widgets_values` positionally and
// the follower has to materialize the text widget itself. A recorded turn
// binds the chat first; the two adds then arrive as a host edit outside the
// recording, the way an agent `add_node` tool call reaches the canvas.
const NOTE_ID = 9001
const MARKDOWN_ID = 9002
const NOTE_TEXT = 'agent note text'
const MARKDOWN_HEADING = 'Agent markdown heading'
const MARKDOWN_BODY = 'markdown body line'
const MARKDOWN_TEXT = `# ${MARKDOWN_HEADING}\n\n${MARKDOWN_BODY}`
const SAVED_NAME = 'Virtual note nodes'

function addVirtualNode(
  id: number,
  type: 'Note' | 'MarkdownNote',
  pos: [number, number],
  text: string
): RecordedGraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: type,
    pos,
    node: {
      id,
      type,
      pos,
      size: [320, 180],
      mode: 0,
      flags: {},
      order: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: [text]
    }
  }
}

const VIRTUAL_NODE_ADDS: RecordedGraphOperation[] = [
  addVirtualNode(NOTE_ID, 'Note', [1400, 100], NOTE_TEXT),
  addVirtualNode(MARKDOWN_ID, 'MarkdownNote', [1400, 400], MARKDOWN_TEXT)
]

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
      const tabs = topbar.workflowTabs.locator('.p-togglebutton')
      const noteText = () =>
        vueNodes.getNodeLocator(String(NOTE_ID)).getByLabel('text', {
          exact: true
        })
      const markdownText = () =>
        vueNodes.getNodeLocator(String(MARKDOWN_ID)).getByLabel('text', {
          exact: true
        })

      // Each node must carry its own text: a follower that minted an empty
      // placeholder widget, or bound both nodes to one value, fails here.
      const expectBothNotes = async () => {
        await expect(noteText()).toHaveValue(NOTE_TEXT)
        await expect(markdownText()).toContainText(MARKDOWN_HEADING)
        await expect(markdownText()).toContainText(MARKDOWN_BODY)
        await expect(markdownText()).not.toContainText(NOTE_TEXT)
      }

      await test.step('host adds a Note and a MarkdownNote', async () => {
        await agentConversation.persistSavedWorkflow()
        await agentConversation.runTurns()
        agentConversation.pushHostOps(VIRTUAL_NODE_ADDS)
        await expectBothNotes()
      })

      // Returning to the bound tab re-subscribes the follower, which replays
      // the whole host document, both note adds included, over the live graph.
      await test.step('both survive switching tabs away and back', async () => {
        await expect(tabs).toHaveCount(1)
        await topbar.newWorkflowButton.click()
        await expect(tabs).toHaveCount(2)
        await expect(vueNodes.nodes).toHaveCount(0)
        const before = agentConversation.subscribeCount()
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBe(before + 1)
        await expectBothNotes()
        // The tab click leaves its preview popover open over the topbar menu.
        await agentConversation.panel.hover()
      })

      // The saved file has to carry both nodes and their text itself: a
      // serializer that dropped an uncatalogued node, or wrote its widget
      // value out of position, would still render fine while the host lives.
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

      // After the reload the host refuses the follower's re-subscribe, so no
      // catch-up can replay the note adds, and reopening the tab has to fetch
      // the saved file from the server: whatever renders came from that file
      // alone, not from local state. (`reloadWithoutLocalWorkflow` cannot be
      // used here: it drops the open tab the workflow picker lists.)
      await test.step('both survive reload and reopen without host replay', async () => {
        agentConversation.refuseHostSubscribes()
        const restoredContent = page.waitForResponse(
          (response) =>
            response.request().method() === 'GET' &&
            decodeURIComponent(new URL(response.url()).pathname) ===
              `/api/userdata/workflows/${SAVED_NAME}.json`,
          { timeout: 60_000 }
        )
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(agentConversation.panel).toBeVisible({ timeout: 30_000 })
        const picker = agentConversation.panel.getByRole('button', {
          name: enMessages.agent.switchWorkflow
        })
        await picker.click()
        await page
          .getByRole('menuitemradio', { name: SAVED_NAME, exact: true })
          .click()
        await expect(picker).toHaveText(SAVED_NAME)
        expect((await restoredContent).ok()).toBe(true)
        await expectBothNotes()
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
