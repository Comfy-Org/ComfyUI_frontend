import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { tabActivationTest as test } from '@e2e/fixtures/agentTabActivationFixture'
import {
  LANDSCAPE_DRAFT,
  LANDSCAPE_NAME,
  LANDSCAPE_REQUEST,
  PORTRAIT_NAME,
  PORTRAIT_REQUEST,
  UNRESTORABLE_THREAD_ID,
  UNRESTORABLE_REQUEST,
  UNBOUND_REQUEST
} from '@e2e/fixtures/data/agent/tabActivationChats'

test.describe(
  'Agent chat follows the active workflow tab',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('brings up the tab’s chat on activation and keeps a draft with its chat', async ({
      tabChats
    }) => {
      await test.step('each chat opens a tab for the workflow it is bound to', async () => {
        await tabChats.openChatFromHistory('Portrait chat')
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          PORTRAIT_REQUEST
        ])
        await expect(
          tabChats.topbar.getWorkflowTab(PORTRAIT_NAME)
        ).toBeVisible()
        await tabChats.openChatFromHistory('Landscape chat')
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          LANDSCAPE_REQUEST
        ])
        await expect(
          tabChats.topbar
            .getWorkflowTab(LANDSCAPE_NAME)
            .and(tabChats.topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('activating the portrait tab brings up the portrait chat', async () => {
        await tabChats.activateWorkflow(PORTRAIT_NAME)
        await expect(
          tabChats.topbar
            .getWorkflowTab(PORTRAIT_NAME)
            .and(tabChats.topbar.getActiveTab())
        ).toBeVisible()
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          PORTRAIT_REQUEST
        ])
      })

      await test.step('a hand-picked chat with no workflow of its own survives the refresh', async () => {
        await tabChats.openChatFromHistory('Unbound chat')
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          UNBOUND_REQUEST
        ])
        await expect(
          tabChats.topbar
            .getWorkflowTab(PORTRAIT_NAME)
            .and(tabChats.topbar.getActiveTab())
        ).toBeVisible()
      })

      await test.step('a draft stays with its chat when another tab is activated and back', async () => {
        await tabChats.openChatFromHistory('Landscape chat')
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          LANDSCAPE_REQUEST
        ])
        await expect(
          tabChats.topbar
            .getWorkflowTab(LANDSCAPE_NAME)
            .and(tabChats.topbar.getActiveTab())
        ).toBeVisible()
        await tabChats.panel.composer.fill(LANDSCAPE_DRAFT)

        await tabChats.activateWorkflow(PORTRAIT_NAME)

        await expect(
          tabChats.topbar
            .getWorkflowTab(PORTRAIT_NAME)
            .and(tabChats.topbar.getActiveTab())
        ).toBeVisible()
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          PORTRAIT_REQUEST
        ])
        await expect(tabChats.panel.composer).toHaveText('')
        await expect(
          tabChats.panel.root.getByText(
            enMessages.agent.viewingDifferentWorkflow
          )
        ).toHaveCount(0)

        await tabChats.activateWorkflow(LANDSCAPE_NAME)

        await expect(
          tabChats.topbar
            .getWorkflowTab(LANDSCAPE_NAME)
            .and(tabChats.topbar.getActiveTab())
        ).toBeVisible()
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          LANDSCAPE_REQUEST
        ])
        await expect(tabChats.panel.composer).toHaveText(LANDSCAPE_DRAFT)
      })
    })

    test('opens an out-of-sync chat without claiming its workflow was deleted', async ({
      tabChats
    }) => {
      await tabChats.selectChatFromHistory('Missing workflow chat')

      await expect(
        tabChats.panel.root.getByRole('heading', {
          name: enMessages.agent.history
        })
      ).toHaveCount(0)
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        UNRESTORABLE_REQUEST
      ])
      await expect(
        tabChats.panel.root.getByText(
          enMessages.agent.targetWorkflowUnavailable
        )
      ).toBeVisible()
      await expect(
        tabChats.panel.root.getByText(enMessages.agent.historyOpenFailed)
      ).toHaveCount(0)
      expect(tabChats.transcriptReads).toEqual([UNRESTORABLE_THREAD_ID])
    })
  }
)
