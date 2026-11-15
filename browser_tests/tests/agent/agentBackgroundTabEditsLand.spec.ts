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
  FOREGROUND_NAME,
  USER_NOTE_POSITION
} from '@e2e/fixtures/data/agent/backgroundTabEdits'
import { AgentWorkflowChatsMock } from '@e2e/fixtures/helpers/agentWorkflowChats'

test.describe(
  'Agent edits to a background workflow tab',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: BACKGROUND_TAB_CASE })

    test.beforeEach(async ({ agentConversation, page }) => {
      test.setTimeout(120_000)
      const panel = new AgentPanel(page)
      const topbar = agentConversation.topbar
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
            id: agentConversation.conversation.workflow.id,
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

      await test.step('user returns to A by its tab', async () => {
        await topbar.getWorkflowTab(FOREGROUND_NAME).click()
        await expect(panel.userMessageBubbles).toHaveText([aRequest])
      })
    })

    test('are on the canvas when the user returns to that tab', async ({
      agentConversation,
      page
    }) => {
      const panel = new AgentPanel(page)
      const topbar = agentConversation.topbar
      const aRequest = agentConversation.conversation.turns[0].request.content

      await test.step('user switches to B by its tab', async () => {
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

    test('do not rebind a tab the user edited while its chat was loading', async ({
      agentConversation,
      page
    }) => {
      const panel = new AgentPanel(page)
      const topbar = agentConversation.topbar
      const subscribesBefore = agentConversation.subscribeCount(BACKGROUND.id)
      const transcript = await agentConversation.holdTranscript(
        BACKGROUND.threadId
      )

      const noteId =
        await test.step('user edits B before its chat loads', async () => {
          await topbar.getWorkflowTab(BACKGROUND.name).click()
          await transcript.requested
          const id = await agentConversation.addNoteThroughSearchBox({
            x: USER_NOTE_POSITION[0],
            y: USER_NOTE_POSITION[1]
          })
          await expect(
            agentConversation.vueNodes.getNodeLocator(id)
          ).toBeVisible()
          return id
        })

      await test.step('B keeps the edit once its chat loads', async () => {
        transcript.release()
        await expect(panel.userMessageBubbles).toHaveText([BACKGROUND.request])
        await expect(
          agentConversation.vueNodes.getNodeLocator(noteId)
        ).toBeVisible()
      })

      await test.step('the next subscribe, to A, finds B never re-subscribed', async () => {
        const aId = agentConversation.conversation.workflow.id
        const aSubscribes = agentConversation.subscribeCount(aId)
        await topbar.getWorkflowTab(FOREGROUND_NAME).click()
        await expect
          .poll(() => agentConversation.subscribeCount(aId))
          .toBeGreaterThan(aSubscribes)
        expect(agentConversation.subscribeCount(BACKGROUND.id)).toBe(
          subscribesBefore
        )
      })
    })
  }
)
