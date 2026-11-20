import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { tabChatTransitionsTest as test } from '@e2e/fixtures/agentTabChatTransitionsFixture'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Workflow tab chat status', { tag: ['@cloud', '@agent'] }, () => {
  test('TS-01/TS-03/TS-05/TS-06 shows busy, unseen after background reply, and clears on open', async ({
    page,
    tabChats
  }) => {
    const tabStatus = (index: number) =>
      tabChats.tab(index).getByTestId(TestIds.topbar.workflowTabStatus)

    await expect(tabStatus(0)).toHaveCount(0)
    await expect(tabStatus(1)).toHaveCount(0)
    await expect(tabStatus(2)).toHaveCount(0)

    await tabChats.panel.sendMessage('Foreground turn')
    await expect(tabStatus(0)).toHaveAttribute('data-status', 'busy')
    await expect(tabStatus(0)).toHaveAttribute(
      'aria-label',
      enMessages.g.agentWorking
    )

    tabChats.complete(0)
    await expect(tabStatus(0)).toHaveCount(0)

    await tabChats.panel.sendMessage('Background turn')
    await expect(tabStatus(0)).toHaveAttribute('data-status', 'busy')
    await tabChats.tab(1).click()
    await expect(tabStatus(0)).toHaveAttribute('data-status', 'busy')

    tabChats.complete(0)
    await expect(tabStatus(0)).toHaveAttribute('data-status', 'unseen')
    await expect(tabStatus(0)).toHaveAttribute(
      'aria-label',
      enMessages.g.agentFinishedUnseen
    )

    await tabChats.tab(0).click()
    await expect(tabStatus(0)).toHaveCount(0)

    await expect(
      tabChats.topbar
        .getWorkflowTab('Unsaved Workflow')
        .getByTestId(TestIds.topbar.workflowTabStatus)
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
        .getByTestId(TestIds.topbar.workflowTabStatus)
    ).toHaveCount(0)
  })
})
