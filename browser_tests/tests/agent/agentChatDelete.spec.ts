import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentChatDeleteTest as test } from '@e2e/fixtures/agentChatDeleteFixture'

test.describe('Agent chat deletion', { tag: ['@cloud', '@agent'] }, () => {
  test('P2-01: deleting the open chat sends DELETE, opens new chat, and removes it from History', async ({
    page,
    agentPanel,
    chatDeleteServer
  }) => {
    await agentPanel.openChatFromHistory('Duck workflow chat')
    await agentPanel.expectUserMessages(['Build a duck'])

    await agentPanel.chatControls
      .getByRole('button', { name: enMessages.agent.chatOptions })
      .click()
    await page
      .getByRole('menuitem', { name: enMessages.g.delete, exact: true })
      .click()

    await expect.poll(() => chatDeleteServer.deleteRequests).toEqual(['th-1'])
    await expect(agentPanel.userMessageBubbles).toHaveCount(0)
    await expect(agentPanel.composer).toBeVisible()

    await agentPanel.historyButton.click()
    await expect(
      agentPanel.root.getByRole('button', {
        name: 'Duck workflow chat',
        exact: true
      })
    ).toHaveCount(0)
  })

  test('P2-03: failed delete restores the chat in History and Retry deletes it on 204', async ({
    page,
    agentPanel,
    chatDeleteServer,
    toast
  }) => {
    chatDeleteServer.setFailDeletes(true)
    await agentPanel.historyButton.click()

    const rowTitle = agentPanel.root.getByRole('button', {
      name: 'Duck workflow chat',
      exact: true
    })
    await expect(rowTitle).toBeVisible()
    await agentPanel.root
      .getByRole('button', { name: enMessages.agent.chatOptions })
      .click()
    await page
      .getByRole('menuitem', { name: enMessages.g.delete, exact: true })
      .click()

    const errorToast = toast.withText(enMessages.agent.deleteFailed)
    await expect(errorToast).toBeVisible()
    await expect(rowTitle).toBeVisible()

    chatDeleteServer.setFailDeletes(false)
    await errorToast
      .getByRole('button', { name: enMessages.g.retry, exact: true })
      .click()

    await expect
      .poll(() => chatDeleteServer.deleteRequests)
      .toEqual(['th-1', 'th-1'])
    await expect(errorToast).toHaveCount(0)
    await expect(rowTitle).toHaveCount(0)
  })
})
