import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'

test.describe('Agent debug log', { tag: ['@cloud', '@agent', '@ui'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('Comfy.Agent.CrdtDebug.enabled', 'true')
      localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
    })
    await bootAgentApp(page, true)
  })

  test(
    'lets a tester select and clear the node materialization filter',
    {
      annotation: {
        type: 'regression',
        description: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/17519'
      }
    },
    async ({ page }) => {
      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
        .click()
      await page.getByTestId('crdt-dev-panel-tab-log').click()

      const filter = page.getByTestId('crdt-dev-panel-filter')
      await filter.selectOption('agent_node_adapters_materialized')
      await expect(filter).toHaveValue('agent_node_adapters_materialized')

      await filter.selectOption('')
      await expect(filter).toHaveValue('')
    }
  )
})
