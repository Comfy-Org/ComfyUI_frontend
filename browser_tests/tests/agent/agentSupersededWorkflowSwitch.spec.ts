import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { tabChatTransitionsTest as test } from '@e2e/fixtures/agentTabChatTransitionsFixture'

test.describe(
  'Superseded switch to an already-open workflow',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('a new chat started while a history chat is opening keeps the user on their own workflow', async ({
      tabChats
    }) => {
      await expect(
        tabChats.tab(0).and(tabChats.topbar.getActiveTab())
      ).toBeVisible()
      await expect(tabChats.panel.workflowPicker).toContainText(
        tabChats.workflows[0].name
      )

      const heldLoad = await tabChats.holdNextGraphLoad()

      await tabChats.panel.openChatFromHistory(
        `${tabChats.workflows[1].name} chat`
      )
      await heldLoad.reached()

      await test.step('the user starts a new chat before the held switch settles', async () => {
        await tabChats.panel.root
          .getByRole('button', { name: enMessages.agent.newChat })
          .click()
        await expect(tabChats.panel.composer).toHaveText('')
      })

      await heldLoad.release()

      await expect(tabChats.panel.userMessageBubbles).toHaveCount(0)
      await expect(
        tabChats.tab(0).and(tabChats.topbar.getActiveTab())
      ).toBeVisible()
      await expect(tabChats.panel.workflowPicker).toContainText(
        tabChats.workflows[0].name
      )
      await expect.poll(heldLoad.abortedLoads).toEqual(['AbortError'])
    })
  }
)
