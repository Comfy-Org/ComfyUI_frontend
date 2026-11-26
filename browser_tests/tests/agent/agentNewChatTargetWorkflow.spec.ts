import { expect, mergeTests } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { agentUserTranscript } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

type PostedAgentMessage = {
  url: string
  body: AgentPostMessageRequest
}

const test = mergeTests(agentTest, workflowSelectionTest).extend<{
  postedMessages: PostedAgentMessage[]
}>({
  postedMessages: async (
    { page, workflowSelection: _workflowSelection },
    use
  ) => {
    const posted: PostedAgentMessage[] = []
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute(
            agentUserTranscript(
              'th-a',
              posted[0]?.body.workflow_id ?? '',
              posted[0]?.body.content ?? ''
            )
          )
        )
      }
      if (route.request().method() !== 'POST') return route.fallback()
      const body = zAgentPostMessageRequest.parse(
        route.request().postDataJSON()
      )
      posted.push({ url: route.request().url(), body })
      const accepted: AgentTurnAccepted = {
        thread_id: 'th-a',
        message_id: 'msg-a',
        workflow_id: body.workflow_id ?? undefined
      }
      return route.fulfill({ ...jsonRoute(accepted), status: 202 })
    })
    await use(posted)
  }
})

// PM-1321 (parent) / PM-1322 (tab switch) / PM-1415 (tab creation): New Chat
// used to keep whatever tab the previous chat was pinned to instead of
// picking up the tab now on screen, so "in this workflow" could silently act
// on a tab the user had already left. AgentPanelRoot.vue's onNewChat() now
// re-targets to workflowStore.activeWorkflow, the same way onSelectHistory()
// re-derives its target instead of carrying the old one forward.
// Supersedes the repro-only PR #18080, whose test asserted a blank "select a
// workflow" target after New Chat; the accepted PM-1321 acceptance criteria
// call for the tab on screen, not a blank state.
test.describe(
  'New chat targets the workflow tab on screen',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('PM-1322 / PM-2251: retargets to a tab the user switched to and starts with an empty composer', async ({
      page,
      workflowSelection,
      postedMessages: posted
    }, testInfo) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const panel = agentPanel.root
      const topbar = new Topbar(page)

      const saving = topbar.saveWorkflowAs('Unsaved Workflow')
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await saving

      const initialComposer = panel.getByRole('textbox', {
        includeHidden: true
      })
      await initialComposer.fill('Start in this workflow')
      const postAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/agent\/threads\/[^/]+\/messages$/.test(response.url()) &&
          response.status() === 202
      )
      await initialComposer.press('Enter')
      await postAccepted
      await expect(initialComposer).toHaveText('')
      await expect(panel.getByTestId('user-message-bubble')).toBeVisible()
      await expect(panel.getByTestId('user-message-bubble')).toHaveText([
        'Start in this workflow'
      ])
      await expect(agentPanel.sendingSpinner).toHaveCount(0)
      await expect(panel.getByTestId('pending-send-error')).toHaveCount(0)
      await expect(agentPanel.stopButton).toBeVisible()
      await initialComposer.fill('Only edit workflow A')

      await page
        .getByRole('button', {
          name: enMessages.sideToolbar.newBlankWorkflow,
          exact: true
        })
        .click()
      await expect(topbar.tabs).toHaveCount(2)
      await topbar.getTab(0).click()
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow')
      await expect(initialComposer).toHaveText('Only edit workflow A')

      await topbar.getTab(1).click()
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
      const panelBeforeNewChat = await panel.screenshot({
        path: testInfo.outputPath('before-new-chat.png')
      })
      await panel
        .getByRole('button', { name: enMessages.agent.newChat })
        .click()
      const composer = panel.getByRole('textbox', { includeHidden: true })
      await expect(composer).toHaveText('')
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
      await composer.fill('Edit workflow B')
      await composer.press('Enter')
      await expect.poll(() => posted.length).toBe(2)
      expect(new URL(posted[1].url).pathname).toBe(
        '/api/agent/threads/new/messages'
      )
      expect(posted[1].body).toMatchObject({
        current_tab_unbound: true
      })
      expect(posted[1].body.workflow_id).toBeUndefined()
      expect(posted[1].body.current_tab).toBeUndefined()

      await testInfo.attach('before-new-chat', {
        body: panelBeforeNewChat,
        contentType: 'image/png'
      })
      await testInfo.attach('after-new-chat', {
        body: await panel.screenshot({
          path: testInfo.outputPath('after-new-chat.png')
        }),
        contentType: 'image/png'
      })
    })

    test('PM-1415: retargets to a tab created for this session', async ({
      page,
      workflowSelection,
      postedMessages: posted
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const panel = agentPanel.root
      const topbar = new Topbar(page)

      const saving = topbar.saveWorkflowAs('Unsaved Workflow')
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await saving

      const initialComposer = panel.getByRole('textbox', {
        includeHidden: true
      })
      await initialComposer.fill('Start in this workflow')
      const postAccepted = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/agent\/threads\/[^/]+\/messages$/.test(response.url()) &&
          response.status() === 202
      )
      await initialComposer.press('Enter')
      await postAccepted
      await expect(initialComposer).toHaveText('')
      await expect(panel.getByTestId('user-message-bubble')).toBeVisible()
      await expect(panel.getByTestId('user-message-bubble')).toHaveText([
        'Start in this workflow'
      ])
      await expect(agentPanel.sendingSpinner).toHaveCount(0)
      await expect(panel.getByTestId('pending-send-error')).toHaveCount(0)
      await expect(agentPanel.stopButton).toBeVisible()

      await page
        .getByRole('button', {
          name: enMessages.sideToolbar.newBlankWorkflow,
          exact: true
        })
        .click()
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')

      await panel
        .getByRole('button', { name: enMessages.agent.newChat })
        .click()
      const composer = panel.getByRole('textbox', { includeHidden: true })
      await expect(composer).toHaveText('')
      await composer.fill('Ask on new tab')
      await composer.press('Enter')
      await expect.poll(() => posted.length).toBe(2)
      expect(new URL(posted[1].url).pathname).toBe(
        '/api/agent/threads/new/messages'
      )
      expect(posted[1].body).toMatchObject({
        current_tab_unbound: true
      })
      expect(posted[1].body.workflow_id).toBeUndefined()
      expect(posted[1].body.current_tab).toBeUndefined()
    })
  }
)
