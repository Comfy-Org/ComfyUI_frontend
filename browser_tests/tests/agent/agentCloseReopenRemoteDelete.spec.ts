import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const DELETED_NODE_ID = '3'
// The seed KSampler's own links: model-in (3), positive-in (2), latent-out (4).
const DELETED_NODE_LINK_IDS = [2, 3, 4]
const SURVIVING_NODE_IDS = ['4', '6', '8', '9']
const SAVED_NAME = 'Close reopen regression'

test.describe(
  'Agent workflow closed and reopened while the host deletes a node',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, blankStartupGraph: true })

    test('does not resurrect a node the host deleted while this client was closed', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('bind the seeded workflow and save its stale state', async () => {
        await agentConversation.persistSavedWorkflow()
        await agentConversation.runTurns()
        await expect(
          agentConversation.vueNodes.getNodeLocator(DELETED_NODE_ID)
        ).toBeVisible()
        await agentConversation.topbar.saveWorkflowAs(SAVED_NAME)
      })

      await test.step('delete remotely while the real workflow tab is closed', async () => {
        agentConversation.deleteNodeOnHost(
          DELETED_NODE_ID,
          DELETED_NODE_LINK_IDS
        )
        await agentConversation.topbar.closeWorkflowTab(SAVED_NAME)
        await expect(
          agentConversation.topbar.getWorkflowTab(SAVED_NAME)
        ).toHaveCount(0)
        await comfyPage.waitForAppReady()
      })

      await test.step('reopen from persistence and receive host catch-up', async () => {
        const before = agentConversation.subscribeCount()
        await comfyPage.workflow.openPersistedWorkflow(SAVED_NAME)
        const picker = agentConversation.panel.getByRole('button', {
          name: enMessages.agent.switchWorkflow
        })
        await picker.click()
        await page
          .getByRole('menuitemradio', { name: SAVED_NAME, exact: true })
          .click()
        await expect(picker).toHaveText(SAVED_NAME)
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
          agentConversation.vueNodes.getNodeLocator(DELETED_NODE_ID)
        ).toHaveCount(0)
        const lens = await agentConversation.readNodeLens()
        expect(lens.live).not.toContain(DELETED_NODE_ID)
        expect(lens.serialized).not.toContain(DELETED_NODE_ID)
        expect(lens.live).toEqual(expect.arrayContaining(SURVIVING_NODE_IDS))
        expect(lens.serialized).toEqual(
          expect.arrayContaining(SURVIVING_NODE_IDS)
        )
      })
    })
  }
)
