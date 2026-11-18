import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  agentThreadPage,
  agentThreadSummary,
  agentUserTranscript
} from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe('Agent chat deletion', { tag: ['@cloud', '@agent'] }, () => {
  test('P2-01: deleting the open chat sends DELETE, opens new chat, and removes it from History', async ({
    page,
    agentFlagEnabled
  }) => {
    let threads = [agentThreadSummary('th-1', 'Duck workflow chat')]
    const deleteRequests: string[] = []

    await page.route(/\/api\/agent\/threads(?:\?.*)?$/, (route) =>
      route.fulfill(jsonRoute(agentThreadPage(threads)))
    )
    await page.route(/\/api\/agent\/threads\/([^/]+)$/, (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback()
      const id = route.request().url().split('/').pop() ?? ''
      deleteRequests.push(id)
      threads = threads.filter((thread) => thread.id !== id)
      return route.fulfill({ status: 204 })
    })
    await page.route(
      /\/api\/agent\/threads\/([^/]+)\/messages(?:\?.*)?$/,
      (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        return route.fulfill(
          jsonRoute(agentUserTranscript('th-1', '', 'Build a duck'))
        )
      }
    )

    await bootAgentApp(page, agentFlagEnabled)
    const agentPanel = new AgentPanel(page)
    await agentPanel.open(30_000)

    await agentPanel.openChatFromHistory('Duck workflow chat')
    await agentPanel.expectUserMessages(['Build a duck'])

    await agentPanel.chatControls
      .getByRole('button', { name: enMessages.agent.chatOptions })
      .click()
    await page
      .getByRole('menuitem', { name: enMessages.g.delete, exact: true })
      .click()

    await expect.poll(() => deleteRequests).toEqual(['th-1'])
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
    agentFlagEnabled,
    toast
  }) => {
    let threads = [agentThreadSummary('th-1', 'Duck workflow chat')]
    let shouldFail = true
    const deleteRequests: string[] = []

    await page.route(/\/api\/agent\/threads(?:\?.*)?$/, (route) =>
      route.fulfill(jsonRoute(agentThreadPage(threads)))
    )
    await page.route(/\/api\/agent\/threads\/([^/]+)$/, (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback()
      const id = route.request().url().split('/').pop() ?? ''
      deleteRequests.push(id)
      if (shouldFail) {
        return route.fulfill({
          ...jsonRoute({ error: 'internal server error' }),
          status: 500
        })
      }
      threads = threads.filter((thread) => thread.id !== id)
      return route.fulfill({ status: 204 })
    })

    await bootAgentApp(page, agentFlagEnabled)
    const agentPanel = new AgentPanel(page)
    await agentPanel.open(30_000)
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

    shouldFail = false
    await errorToast
      .getByRole('button', { name: enMessages.g.retry, exact: true })
      .click()

    await expect.poll(() => deleteRequests).toEqual(['th-1', 'th-1'])
    await expect(errorToast).toHaveCount(0)
    await expect(rowTitle).toHaveCount(0)
  })
})
