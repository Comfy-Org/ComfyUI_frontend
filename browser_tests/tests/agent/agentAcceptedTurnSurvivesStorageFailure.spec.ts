import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent accepted turn storage failure',
  {
    tag: ['@cloud', '@ui'],
    annotation: {
      type: 'issue',
      description: 'https://github.com/Comfy-Org/ComfyUI_frontend/issues/17358'
    }
  },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        const setItem = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
          if (key.startsWith('Comfy.Agent.ThreadId:'))
            throw new DOMException(
              'Storage is unavailable',
              'QuotaExceededError'
            )
          setItem.call(this, key, value)
        }
      })
    })

    test('keeps the accepted message visible and the turn running', async ({
      acceptedTurns,
      agentPanel
    }) => {
      const prompt = 'Add a warm sunset behind the subject'

      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill(prompt)
      await agentPanel.sendButton.click()

      await expect(agentPanel.userMessageBubbles).toHaveText([prompt])
      await expect(agentPanel.stopButton).toBeVisible()
      await expect(
        agentPanel.root.getByText(enMessages.agent.sendFailed)
      ).toHaveCount(0)
      expect(acceptedTurns).toHaveLength(1)
    })
  }
)
