import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { tabChatTransitionsTest as test } from '@e2e/fixtures/agentTabChatTransitionsFixture'

test.describe(
  'Workflow tab chat transitions',
  { tag: ['@cloud', '@agent'] },
  () => {
    for (const status of [200, 500]) {
      test(`a late recheck of B’s chat (${status}) cannot take over after returning to A`, async ({
        tabChats
      }) => {
        const pending = tabChats.holdMessages(1, status)

        await tabChats.tab(1).click()
        await pending.entered
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          'Landscape existing request'
        ])
        await expect(tabChats.opening(1)).toHaveCount(0)
        await expect(tabChats.panel.composer).toBeEditable()
        await tabChats.tab(0).click()
        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          'Portrait existing request'
        ])
        await expect(tabChats.opening(1)).toHaveCount(0)

        await pending.release()

        await expect(tabChats.panel.userMessageBubbles).toHaveText([
          'Portrait existing request'
        ])
        await expect(
          tabChats.tab(0).and(tabChats.topbar.getActiveTab())
        ).toBeVisible()
        await expect(tabChats.panel.root.getByRole('note')).toContainText(
          'Portrait'
        )
        await expect(tabChats.panel.composer).toBeEditable()
        await expect(
          tabChats.panel.root.getByRole('button', {
            name: enMessages.agent.retryFollowedChat.replace(
              '{workflowName}',
              tabChats.workflows[1].name
            ),
            exact: true
          })
        ).toHaveCount(0)
      })
    }

    test('a draft stays with its chat across a tab change and Send posts it there', async ({
      tabChats
    }) => {
      await tabChats.panel.composer.fill('Draft addressed to Portrait')
      await tabChats.tab(1).click()
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Landscape existing request'
      ])
      await expect(tabChats.panel.composer).toHaveText('')
      await expect(
        tabChats.panel.root.getByText(enMessages.agent.viewingDifferentWorkflow)
      ).toHaveCount(0)

      await tabChats.tab(0).click()
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Portrait existing request'
      ])
      await expect(tabChats.panel.composer).toHaveText(
        'Draft addressed to Portrait'
      )
      expect(tabChats.posted).toEqual([])

      await tabChats.panel.sendButton.click()

      await expect.poll(() => tabChats.posted).toHaveLength(1)
      expect(tabChats.posted[0]).toMatchObject({
        requestedThreadId: tabChats.threads[0],
        threadId: tabChats.threads[0],
        body: {
          content: 'Draft addressed to Portrait',
          workflow_id: tabChats.workflows[0].id
        }
      })
      await expect(
        tabChats.tab(0).and(tabChats.topbar.getActiveTab())
      ).toBeVisible()
      await expect(tabChats.working(0)).toBeVisible()
    })

    test('a skill-only draft stays with its chat across a tab change', async ({
      page,
      tabChats
    }) => {
      await tabChats.panel.composer.fill('/')
      await page
        .getByRole('menuitem', { name: tabChats.skillName, exact: true })
        .click()
      await expect(tabChats.panel.composer).toHaveText(`/${tabChats.skillName}`)
      await expect(
        tabChats.panel.composer.getByTestId('skill-reference')
      ).toHaveCount(1)

      await tabChats.tab(1).click()

      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Landscape existing request'
      ])
      await expect(tabChats.panel.composer).toHaveText('')
      await expect(
        tabChats.panel.composer.getByTestId('skill-reference')
      ).toHaveCount(0)

      await tabChats.tab(0).click()

      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Portrait existing request'
      ])
      await expect(tabChats.panel.composer).toHaveText(`/${tabChats.skillName}`)
      await expect(
        tabChats.panel.composer.getByTestId('skill-reference')
      ).toHaveCount(1)
      await expect(
        tabChats.panel.root.getByText(enMessages.agent.viewingDifferentWorkflow)
      ).toHaveCount(0)
      expect(tabChats.posted).toEqual([])
    })

    test('independent background completions clear only their own visible tab indicators', async ({
      tabChats
    }) => {
      await tabChats.panel.sendMessage('A turn')
      await expect(tabChats.working(0)).toBeVisible()
      const pending = tabChats.holdMessages(1)

      await tabChats.tab(1).click()
      await pending.entered
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Landscape existing request'
      ])
      await expect(tabChats.opening(1)).toHaveCount(0)
      await expect(tabChats.working(0)).toBeVisible()
      await pending.release()
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Landscape existing request'
      ])
      await expect(tabChats.working(0)).toBeVisible()
      await tabChats.panel.sendMessage('B turn')
      await expect(tabChats.working(1)).toBeVisible()
      await tabChats.tab(2).click()
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Still Life existing request'
      ])
      await expect(tabChats.working(0)).toBeVisible()
      await expect(tabChats.working(1)).toBeVisible()

      tabChats.complete(0)

      await expect(tabChats.working(0)).toHaveCount(0)
      await expect(tabChats.updated(0)).toBeVisible()
      await expect(tabChats.working(1)).toBeVisible()
      await expect(tabChats.updated(1)).toHaveCount(0)

      tabChats.complete(1)

      await expect(tabChats.working(1)).toHaveCount(0)
      await expect(tabChats.updated(1)).toBeVisible()
      await expect(tabChats.updated(0)).toBeVisible()
      await expect(
        tabChats.tab(2).and(tabChats.topbar.getActiveTab())
      ).toBeVisible()
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Still Life existing request'
      ])
      expect(tabChats.posted).toHaveLength(2)
    })

    test('kept chat with a newer turn in this page shows at once on return without duplicates (TC-17, TC-18)', async ({
      tabChats
    }) => {
      await tabChats.panel.sendMessage('New prompt in A')
      await expect.poll(() => tabChats.posted).toHaveLength(1)
      tabChats.sendDelta(0, 'Reply in A')
      await expect(tabChats.panel.conversation).toContainText('Reply in A')

      await tabChats.tab(1).click()
      await tabChats.panel.sendMessage('New prompt in B')
      await expect.poll(() => tabChats.posted).toHaveLength(2)
      await expect(tabChats.working(1)).toBeVisible()

      const pendingA = tabChats.holdMessages(0)
      await tabChats.tab(0).click()

      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Portrait existing request',
        'New prompt in A'
      ])
      await expect(tabChats.panel.conversation).toContainText('Reply in A')
      await expect(tabChats.panel.stopButton).toBeVisible()
      await expect(tabChats.opening(0)).toHaveCount(0)

      tabChats.complete(0)
      await pendingA.entered
      await pendingA.release()

      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Portrait existing request',
        'New prompt in A'
      ])
      await expect(tabChats.panel.conversation).toContainText('Reply in A')
      await expect(tabChats.panel.sendButton).toBeVisible()
    })

    test('Ryan sequence: two blank tabs create chats and returning to each shows at once without loading or duplicates (TC-15, TC-16, TC-18)', async ({
      blankTabChats
    }) => {
      await test.step('send hi in blank tab A', async () => {
        await blankTabChats.panel.sendMessage('hi')
        await expect.poll(() => blankTabChats.posted).toHaveLength(1)
        blankTabChats.sendDelta(0, 'Reply in A')
        await expect(blankTabChats.panel.conversation).toContainText(
          'Reply in A'
        )
        await expect(blankTabChats.panel.stopButton).toBeVisible()
      })

      await test.step('switch to blank tab B and send hi', async () => {
        await blankTabChats.tab(1).click()
        await expect(blankTabChats.panel.userMessageBubbles).toHaveCount(0)

        await blankTabChats.panel.sendMessage('hi')
        await expect.poll(() => blankTabChats.posted).toHaveLength(2)
        blankTabChats.sendDelta(1, 'Reply in B')
        blankTabChats.complete(1)
      })

      await test.step('return to A while A runs and verify no loading or duplicates', async () => {
        const pendingA = blankTabChats.holdMessages(0)
        await blankTabChats.tab(0).click()

        await expect(blankTabChats.panel.userMessageBubbles).toHaveText(['hi'])
        await expect(blankTabChats.panel.conversation).toContainText(
          'Reply in A'
        )
        await expect(blankTabChats.panel.stopButton).toBeVisible()
        await expect(blankTabChats.opening(0)).toHaveCount(0)

        blankTabChats.sendDelta(0, '!')
        await expect(blankTabChats.panel.conversation).toContainText(
          'Reply in A!'
        )
        blankTabChats.complete(0)
        await pendingA.entered
        await pendingA.release()

        await expect(blankTabChats.panel.userMessageBubbles).toHaveText(['hi'])
        await expect(blankTabChats.panel.conversation).toContainText(
          'Reply in A!'
        )
        await expect(blankTabChats.panel.sendButton).toBeVisible()
      })

      await test.step('return to B after B finished and verify no loading or duplicates', async () => {
        const pendingB = blankTabChats.holdMessages(1)
        await blankTabChats.tab(1).click()
        await pendingB.entered

        await expect(blankTabChats.panel.userMessageBubbles).toHaveText(['hi'])
        await expect(blankTabChats.panel.conversation).toContainText(
          'Reply in B'
        )
        await expect(blankTabChats.panel.stopButton).toHaveCount(0)
        await expect(blankTabChats.opening(1)).toHaveCount(0)

        await pendingB.release()

        await expect(blankTabChats.panel.userMessageBubbles).toHaveText(['hi'])
        await expect(blankTabChats.panel.conversation).toContainText(
          'Reply in B'
        )
      })
    })
  }
)
