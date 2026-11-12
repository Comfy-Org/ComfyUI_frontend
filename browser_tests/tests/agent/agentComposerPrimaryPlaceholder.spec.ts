import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent composer primary placeholder (PM-1233)',
  { tag: '@cloud' },
  () => {
    test('states one primary action and offers references as a control', async ({
      agentPanel
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      const panel = agentPanel.root

      const placeholder = panel.getByText(enMessages.agent.placeholder, {
        exact: true
      })
      await expect(placeholder).toHaveText(enMessages.agent.placeholder)
      await expect(agentPanel.composer).toHaveText('')

      const reference = panel.getByRole('button', {
        name: enMessages.agent.reference,
        exact: true
      })
      await expect(reference).toBeVisible()

      await reference.click()
      await expect(
        panel.getByRole('menuitem', { name: enMessages.agent.nodes })
      ).toBeVisible()
      await expect(
        panel.getByRole('menuitem', { name: enMessages.agent.workflows })
      ).toBeVisible()
    })
  }
)
