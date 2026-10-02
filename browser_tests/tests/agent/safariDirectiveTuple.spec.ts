import { expect } from '@playwright/test'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

test.describe(
  'Safari directive tuple resilience',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('keeps the shell, canvas, and Agent panel visible when tooltip tuples cannot be iterated', async ({
      page
    }) => {
      await page.addInitScript(() => {
        const nativeIterator = Array.prototype[Symbol.iterator]

        Array.prototype[Symbol.iterator] = function () {
          if (new Error().stack?.includes('withDirectives')) {
            throw new TypeError(
              'undefined is not a function (near directive tuple iterator)'
            )
          }

          return nativeIterator.call(this)
        }
      })

      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await bootAgentApp(page, true)

      await expect(page.getByTestId('topbar-workflow-tabs')).toBeVisible()
      await expect(page.locator('#graph-canvas-container')).toBeVisible()

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await expect(page.getByTestId('docked-agent-panel')).toBeVisible()
      expect(pageErrors).toEqual([])
    })
  }
)
