import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { tabChatTransitionsTest as test } from '@e2e/fixtures/agentTabChatTransitionsFixture'

test.describe(
  'Workflow tab chat transitions',
  { tag: ['@cloud', '@agent'] },
  () => {
    for (const status of [200, 500]) {
      test(`late B messages ${status} cannot take over after returning to A`, async ({
        tabChats
      }) => {
        const pending = tabChats.holdMessages(1, status)

        await tabChats.tab(1).click()
        await pending.entered
        await expect(tabChats.opening(1)).toBeVisible()
        await expect(tabChats.panel.sendButton).toBeDisabled()
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
        await expect(tabChats.panel.workflowPicker).toContainText('Portrait')
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

    test('Send routes an A-pinned draft to A while B is selected', async ({
      tabChats
    }) => {
      await tabChats.panel.composer.fill('Draft addressed to Portrait')
      await tabChats.tab(1).click()
      await expect(tabChats.panel.root.getByRole('note')).toContainText(
        enMessages.agent.viewingDifferentWorkflow
      )
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Portrait existing request'
      ])

      await tabChats.panel.sendButton.click()

      await expect.poll(() => tabChats.posted).toHaveLength(1)
      expect(tabChats.posted[0]).toMatchObject({
        threadId: tabChats.threads[0],
        body: {
          content: 'Draft addressed to Portrait',
          workflow_id: tabChats.workflows[0].id
        }
      })
      await expect(
        tabChats.tab(1).and(tabChats.topbar.getActiveTab())
      ).toBeVisible()
      await expect(tabChats.working(0)).toBeVisible()
    })

    test('a skill-only draft survives B activation without retargeting A', async ({
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

      await expect(tabChats.panel.composer).toHaveText(`/${tabChats.skillName}`)
      await expect(
        tabChats.panel.composer.getByTestId('skill-reference')
      ).toHaveCount(1)
      await expect(tabChats.panel.userMessageBubbles).toHaveText([
        'Portrait existing request'
      ])
      await expect(tabChats.panel.workflowPicker).toContainText('Portrait')
      await expect(tabChats.panel.root.getByRole('note')).toContainText(
        enMessages.agent.viewingDifferentWorkflow
      )
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
      await expect(tabChats.opening(1)).toBeVisible()
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
      await expect(tabChats.panel.workflowPicker).toContainText('Still Life')
      expect(tabChats.posted).toHaveLength(2)
    })
  }
)
