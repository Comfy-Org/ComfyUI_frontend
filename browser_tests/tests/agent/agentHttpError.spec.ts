import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.page.evaluate((status) => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const method =
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      if (method === 'POST' && /\/agent\/threads\/[^/]+\/messages$/.test(url))
        return new Response('', { status })
      return originalFetch(input, init)
    }
  }, 503)
})

test(
  'shows the HTTP status when a failed send has no error message',
  { tag: '@cloud' },
  async ({ agentPanel }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()

    await agentPanel.sendMessage('Build a product photo workflow')

    await expect(
      agentPanel.root.getByText(
        `${enMessages.agent.sendFailed}: Agent request failed (HTTP 503)`,
        { exact: true }
      )
    ).toBeVisible()
  }
)
