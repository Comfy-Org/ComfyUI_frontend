import { expect } from '@playwright/test'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

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
      await new AgentPanel(page).open()
      await page.getByTestId('crdt-dev-panel-tab-log').click()

      const filter = page.getByTestId('crdt-dev-panel-filter')
      await filter.selectOption('agent_node_adapters_materialized')
      await expect(filter).toHaveValue('agent_node_adapters_materialized')

      await filter.selectOption('')
      await expect(filter).toHaveValue('')
    }
  )
})
