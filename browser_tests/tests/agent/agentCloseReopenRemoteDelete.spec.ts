import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Agent workflow closed and reopened while the host deletes a node',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      blankStartupGraph: true
    })

    test('does not resurrect a node the host deleted while this client was closed', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      test.setTimeout(90_000)
      const deletedNodeId = '3'
      const deletedNodeLinkIds = [2, 3, 4]
      const survivingNodeIds = ['4', '6', '8', '9']
      const savedName = 'Close reopen regression'

      await test.step('bind the seeded workflow and save its stale state', async () => {
        await agentConversation.persistSavedWorkflow()
        await agentConversation.runTurns()
        await expect(
          agentConversation.vueNodes.getNodeLocator(deletedNodeId)
        ).toBeVisible()
        await agentConversation.topbar.saveWorkflowAs(savedName)
      })

      await test.step('delete remotely while the real workflow tab is closed', async () => {
        await agentConversation.topbar.closeWorkflowTab(savedName)
        await expect(
          agentConversation.topbar.getWorkflowTab(savedName)
        ).toHaveCount(0)
        await comfyPage.waitForAppReady()
        agentConversation.deleteNodeOnHost(deletedNodeId, deletedNodeLinkIds)
      })

      await test.step('reopen from persistence and receive host catch-up', async () => {
        const before = agentConversation.subscribeCount()
        await comfyPage.workflow.openPersistedWorkflow(savedName)
        const picker = agentConversation.panel.getByRole('button', {
          name: enMessages.agent.switchWorkflow
        })
        await picker.click()
        await page
          .getByRole('menuitemradio', { name: savedName, exact: true })
          .click()
        await expect(picker).toHaveText(savedName)
        await agentConversation.sendPrompt()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(before)
        await agentConversation.waitForPendingFrames(
          '6',
          'text',
          'catch-up landed after reopen'
        )
      })

      await test.step('keep the remote deletion after reconciliation', async () => {
        await expect(
          agentConversation.vueNodes.getNodeLocator(deletedNodeId)
        ).toHaveCount(0)
        const lens = await agentConversation.readNodeLens()
        expect(lens.live).not.toContain(deletedNodeId)
        expect(lens.serialized).not.toContain(deletedNodeId)
        expect(lens.live).toEqual(expect.arrayContaining(survivingNodeIds))
        expect(lens.serialized).toEqual(
          expect.arrayContaining(survivingNodeIds)
        )
      })
    })
  }
)
