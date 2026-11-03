import { expect } from '@playwright/test'

import {
  agentConversationTest as test,
  THREAD_ID
} from '@e2e/fixtures/agentConversationFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  BACKGROUND,
  BACKGROUND_NODES,
  BACKGROUND_TAB_CASE,
  backgroundEdits,
  backgroundTabChats,
  FOREGROUND_NAME
} from '@e2e/fixtures/data/agent/backgroundTabEdits'
import { AgentWorkflowChatsMock } from '@e2e/fixtures/helpers/agentWorkflowChats'

test.describe(
  'Agent edits to a background workflow tab',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: BACKGROUND_TAB_CASE })

    test('are on the canvas when the user returns to that tab', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(120_000)
      const panel = new AgentPanel(page)
      const topbar = agentConversation.topbar
      const aId = agentConversation.conversation.workflow.id
      const aRequest = agentConversation.conversation.turns[0].request.content

      await test.step('agent edits workflow A', () =>
        agentConversation.runTurns())

      await test.step('workflow B has a saved chat of its own', async () => {
        agentConversation.serveWorkflow(BACKGROUND.id, {
          ...agentConversation.conversation.workflow.seed,
          nodes: [],
          links: []
        })
        await new AgentWorkflowChatsMock(
          backgroundTabChats({
            id: aId,
            threadId: THREAD_ID,
            request: aRequest
          })
        ).route(page)
      })

      await test.step('user opens workflow B and its chat', async () => {
        await panel.historyButton.click()
        await panel.root
          .getByRole('button', { name: `${BACKGROUND.name} chat`, exact: true })
          .click()
        await expect(panel.userMessageBubbles).toHaveText([BACKGROUND.request])
        await expect(
          topbar.getWorkflowTab(BACKGROUND.name).and(topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('user returns to A, then switches to B by its tab', async () => {
        await topbar.getWorkflowTab(FOREGROUND_NAME).click()
        await expect(panel.userMessageBubbles).toHaveText([aRequest])
        await topbar.getWorkflowTab(BACKGROUND.name).click()
        await expect(panel.userMessageBubbles).toHaveText([BACKGROUND.request])
        await expect(
          topbar.getWorkflowTab(BACKGROUND.name).and(topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('agent adds three titled nodes to A while B is shown', () =>
        agentConversation.applyOpsOnHostUnsent(backgroundEdits()))

      await test.step('returning to A shows every background edit', async () => {
        await topbar.getWorkflowTab(FOREGROUND_NAME).click()
        await expect(
          topbar.getWorkflowTab(FOREGROUND_NAME).and(topbar.getActiveTab())
        ).toBeVisible()
        await expect(panel.userMessageBubbles).toHaveText([aRequest])
        for (const { id, title } of BACKGROUND_NODES)
          await expect(
            agentConversation.vueNodes
              .getNodeLocator(String(id))
              .getByTestId('node-title')
          ).toHaveText(title)
      })
    })
  }
)
