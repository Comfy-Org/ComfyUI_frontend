import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { tabChatTransitionsTest as test } from '@e2e/fixtures/agentTabChatTransitionsFixture'

test.describe('Workflow tab chat status', { tag: ['@cloud', '@agent'] }, () => {
  test('TS-01/TS-02/TS-03/TS-05/TS-06 shows gray seen, spinning, green unseen, and nothing without a chat', async ({
    page,
    tabChats
  }) => {
    const chatStatus = (index: number) =>
      tabChats.tab(index).getByTestId('workflow-chat-status')

    await expect(chatStatus(0)).toHaveAttribute('data-status', 'seen')
    await expect(chatStatus(0)).toHaveClass(/bg-muted-foreground/)
    await expect(chatStatus(1)).toHaveAttribute('data-status', 'seen')
    await expect(chatStatus(2)).toHaveAttribute('data-status', 'seen')

    await tabChats.panel.sendMessage('Foreground turn')
    await expect(chatStatus(0)).toHaveAttribute('data-status', 'in-progress')
    await expect(chatStatus(0)).toHaveAttribute(
      'aria-label',
      enMessages.g.agentWorking
    )

    tabChats.complete(0)
    await expect(chatStatus(0)).toHaveAttribute('data-status', 'seen')
    await expect(chatStatus(0)).toHaveAttribute(
      'aria-label',
      enMessages.g.agentChat
    )

    await tabChats.panel.sendMessage('Background turn')
    await expect(chatStatus(0)).toHaveAttribute('data-status', 'in-progress')
    await tabChats.tab(1).click()
    await expect(chatStatus(0)).toHaveAttribute('data-status', 'in-progress')

    tabChats.complete(0)
    await expect(chatStatus(0)).toHaveAttribute('data-status', 'unseen')
    await expect(chatStatus(0)).toHaveClass(/bg-success/)
    await expect(chatStatus(0)).toHaveAttribute(
      'aria-label',
      enMessages.g.agentModified
    )

    await tabChats.tab(0).click()
    await expect(chatStatus(0)).toHaveAttribute('data-status', 'seen')

    await expect(
      tabChats.topbar
        .getWorkflowTab('Unsaved Workflow')
        .getByTestId('workflow-chat-status')
    ).toHaveCount(0)

    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await expect(tabChats.topbar.tabs).toHaveCount(5)
    await expect(
      tabChats.topbar
        .getWorkflowTab('Unsaved Workflow (2)')
        .getByTestId('workflow-chat-status')
    ).toHaveCount(0)
  })
})
