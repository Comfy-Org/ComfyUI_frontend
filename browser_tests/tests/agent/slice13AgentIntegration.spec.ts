import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  MESSAGE_DELTA_EVENT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = agentTest
const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('slice 13 agent runtime integration', { tag: '@cloud' }, () => {
  test('creates a new session through the integrated composer', async ({
    comfyPage,
    postedMessages
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    const panel = page.locator('#agent-panel-root')

    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('Make a fox')
    await panel.getByRole('button', { name: 'Send' }).click()

    await expect.poll(() => postedMessages).toHaveLength(1)
    await expect(
      panel.getByText('Make a fox', { exact: true }).last()
    ).toBeVisible()
    await expect(
      panel.getByRole('button', { name: 'Stop', exact: true })
    ).toBeVisible()
  })

  test.describe('resumed thread', () => {
    test.use({ agentResumedThread: true })

    test('hydrates a selected server thread into the normalized transcript', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')

      await panel
        .getByRole('button', { name: enMessages.agent.showChatHistory })
        .click()
      await panel.getByText('Saved fox chat').click()

      await expect(
        panel.getByText('Build a saved fox workflow', { exact: true }).last()
      ).toBeVisible()
      await expect(
        panel.getByText('The saved fox workflow is ready.')
      ).toBeVisible()
    })
  })

  test('renders a streamed event for the active turn', async ({
    comfyPage,
    postedMessages
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    const panel = page.locator('#agent-panel-root')
    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('Stream it')
    await panel.getByRole('button', { name: 'Send' }).click()
    await expect.poll(() => postedMessages).toHaveLength(1)
    await page.evaluate((event) => {
      const api = window.app?.api as unknown as
        | {
            dispatchCustomEvent(type: string, detail: unknown): boolean
          }
        | undefined
      api?.dispatchCustomEvent(event.type, event.data)
    }, MESSAGE_DELTA_EVENT satisfies AgentWsEvent)

    await expect(
      panel.locator('strong', { hasText: 'fully ready' })
    ).toBeVisible()
  })

  test('cancels the active turn through the shared transport', async ({
    cancelRequests,
    comfyPage,
    postedMessages
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    const panel = page.locator('#agent-panel-root')

    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('Stop it')
    await panel.getByRole('button', { name: 'Send' }).click()
    await expect.poll(() => postedMessages).toHaveLength(1)
    await panel.getByRole('button', { name: 'Stop', exact: true }).click()

    await expect.poll(() => cancelRequests).toHaveLength(1)
  })

  test('restores the gated panel after a page reload', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(page.locator('#agent-panel-root')).toBeVisible()

    await comfyPage.workflow.reloadAndWaitForApp()

    await expect(page.locator('#agent-panel-root')).toBeVisible()
  })

  test.describe('server failure', () => {
    test.use({ agentMessageError: true })

    test('surfaces the failed turn and returns the composer to idle', async ({
      comfyPage,
      postedMessages
    }) => {
      const page = comfyPage.page
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')

      await panel
        .getByRole('textbox', { name: /^Describe ideas/ })
        .fill('Fail this turn')
      await panel.getByRole('button', { name: 'Send' }).click()

      await expect.poll(() => postedMessages).toHaveLength(1)
      await expect(panel.getByText(/mock agent server failure/)).toBeVisible()
      await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    })
  })
})
