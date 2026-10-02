import { expect } from '@playwright/test'

import { WorkflowActionsDropdown } from '@e2e/fixtures/components/WorkflowActionsDropdown'
import { deployToComfyApiTest as test } from '@e2e/fixtures/deployToComfyApiFixture'

test.describe('Deploy to Comfy API', () => {
  test('opens the deploy card from the workflow actions menu', async ({
    comfyPage
  }) => {
    const actions = new WorkflowActionsDropdown(comfyPage.page)

    await actions.trigger.click()
    await actions.menu
      .getByRole('menuitem', { name: 'Deploy to Comfy API' })
      .click()

    const card = comfyPage.page
      .getByRole('dialog')
      .getByTestId('deploy-to-comfy-api-card')
    await expect(card).toBeVisible()
    await expect(
      card.getByRole('heading', { name: 'Deploy to Comfy API' })
    ).toBeVisible()
  })
})
