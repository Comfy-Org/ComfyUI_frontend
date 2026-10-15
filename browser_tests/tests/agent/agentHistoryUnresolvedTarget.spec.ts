import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentUnresolvedHistoryTest as test } from '@e2e/fixtures/agentUnresolvedHistoryFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'

test.describe(
  'Agent history with an unresolved workflow target',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('reads the chat without changing the canvas and requires explicit selection to send', async ({
      page,
      unresolvedHistory
    }) => {
      const { posted, chosenId, chatTitle, earlierPrompt } = unresolvedHistory
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const topbar = new Topbar(page)
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow')
      const serializeGraph = () =>
        page.evaluate(() => window.app!.graph.serialize())
      const originalGraph = await serializeGraph()

      await test.step('open the chat from History', async () => {
        await panel
          .getByRole('button', { name: enMessages.agent.showChatHistory })
          .click()
        await panel
          .getByRole('button', { name: chatTitle, exact: true })
          .click()
        await expect(panel.getByTestId('user-message-bubble')).toHaveText([
          earlierPrompt
        ])
        await expect(
          panel.getByRole('heading', { name: enMessages.agent.history })
        ).toBeHidden()
        await expect(agentPanel.workflowPicker).toHaveText(
          enMessages.agent.selectWorkflowForAgent
        )
        await expect(
          panel.getByText(enMessages.agent.targetWorkflowUnavailable)
        ).toBeHidden()
        await expect(topbar.tabs).toHaveCount(1)
        expect(await serializeGraph()).toEqual(originalGraph)
      })

      await test.step('send waits for a workflow pick', async () => {
        await agentPanel.sendMessage('Continue in my chosen workflow')
        await expect(
          page.getByPlaceholder(enMessages.agent.searchWorkflows)
        ).toBeVisible()
        expect(await serializeGraph()).toEqual(originalGraph)
        await page.keyboard.press('Escape')
        await expect(agentPanel.composer).toHaveText(
          'Continue in my chosen workflow'
        )
      })

      await test.step('send to the picked workflow', async () => {
        await agentPanel.selectWorkflow()
        await agentPanel.sendButton.click()
        await expect(panel.getByTestId('user-message-bubble')).toHaveText([
          earlierPrompt,
          'Continue in my chosen workflow'
        ])
        expect(posted).toEqual([
          expect.objectContaining({
            workflow_id: chosenId,
            draft: expect.objectContaining({
              content: expect.objectContaining({ nodes: originalGraph.nodes })
            })
          })
        ])
        await expect(agentPanel.workflowPicker).toHaveText('Unsaved Workflow')
      })
    })
  }
)
