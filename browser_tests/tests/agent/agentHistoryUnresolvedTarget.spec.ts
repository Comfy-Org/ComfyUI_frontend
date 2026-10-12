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
      const { posted, chosenId } = unresolvedHistory
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const topbar = new Topbar(page)
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow')
      const originalGraph = await page.evaluate(() =>
        window.app!.graph.serialize()
      )
      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()
      await panel
        .getByRole('button', { name: 'Unresolved workflow chat', exact: true })
        .click()
      await expect(panel.getByTestId('user-message-bubble')).toHaveText([
        'Earlier prompt'
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
      expect(await page.evaluate(() => window.app!.graph.serialize())).toEqual(
        originalGraph
      )

      await agentPanel.composer.fill('Continue in my chosen workflow')
      await agentPanel.sendButton.click()
      await expect(
        page.getByPlaceholder(enMessages.agent.searchWorkflows)
      ).toBeVisible()
      expect(posted).toEqual([])
      expect(await page.evaluate(() => window.app!.graph.serialize())).toEqual(
        originalGraph
      )
      await page.keyboard.press('Escape')
      await expect(agentPanel.composer).toHaveText(
        'Continue in my chosen workflow'
      )

      await agentPanel.workflowPicker.click()
      await page
        .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
        .click()
      await expect(agentPanel.workflowPicker).toHaveText('Unsaved Workflow')
      await page
        .getByRole('button', {
          name: enMessages.sideToolbar.newBlankWorkflow,
          exact: true
        })
        .click()
      await expect(topbar.tabs).toHaveCount(2)
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
      await agentPanel.sendButton.click()
      await expect(panel.getByTestId('user-message-bubble')).toHaveText([
        'Earlier prompt',
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
      await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
      await expect(agentPanel.workflowPicker).toHaveText('Unsaved Workflow')
    })
  }
)
