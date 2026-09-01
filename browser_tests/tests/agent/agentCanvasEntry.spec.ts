import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe('Agent canvas entry', { tag: ['@cloud', '@ui'] }, () => {
  test('sends with Enter and opens the full Agent panel', async ({
    comfyPage,
    postedMessages
  }) => {
    const page = comfyPage.page
    const composer = page.getByRole('textbox', {
      name: enMessages.agent.compactComposer.label
    })
    const prompt = 'Build a product photo workflow with a saved image output.'

    await expect(composer).toBeVisible()
    await composer.fill(prompt)
    await composer.press('Enter')

    await expect.poll(() => postedMessages.length).toBe(1)
    expect(postedMessages[0]).toContain(prompt)
    await expect(page.locator('#agent-panel-root')).toBeVisible()
    await expect(composer).toHaveCount(0)
  })
})
