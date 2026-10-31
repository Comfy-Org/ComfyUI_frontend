import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.page.evaluate(() => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) =>
      init?.method === 'POST' &&
      /\/agent\/threads\/[^/]+\/messages$/.test(String(input))
        ? new Response('gateway did not return an Agent error body', {
            status: 503,
            statusText: 'No error message'
          })
        : originalFetch(input, init)
  })
})

test(
  'names the failed operation when an upstream status text has no error message',
  { tag: '@cloud' },
  async ({ agentPanel }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()

    await agentPanel.sendMessage('Build a product photo workflow')

    await expect(
      agentPanel.root.getByText(
        `${enMessages.agent.sendFailed}: Agent request failed (HTTP 503, post_thread_message)`,
        { exact: true }
      )
    ).toBeVisible()
  }
)
